import os
import argparse
from datetime import datetime
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def parse_cutoff_datetime(value):
    """
    Parse cutoff input into datetime.
    Accepted formats:
      - YYYY-MM-DD
      - YYYY-MM-DD HH:MM:SS
      - YYYY-MM-DD HH:MM:SS.ffffff
      - ISO format (T separator also supported)
    """
    if not value:
        raise ValueError("Cutoff date is required")

    raw = value.strip()
    # Try Python's ISO parser first (supports both ' ' and 'T' separators)
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        pass

    # Fallback explicit formats
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue

    raise ValueError(
        "Invalid date format. Use 'YYYY-MM-DD' or "
        "'YYYY-MM-DD HH:MM:SS[.ffffff]'."
    )


def _build_s3_client():
    """
    Create and return a boto3 S3 client using environment variables.
    """
    try:
        import boto3
    except ImportError as exc:
        raise ImportError(
            "boto3 is required for S3 cleanup. Install it with: pip install boto3"
        ) from exc

    aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region = os.getenv("AWS_REGION", "us-east-1")

    if not aws_access_key_id or not aws_secret_access_key:
        raise ValueError(
            "AWS credentials are missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
        )

    return boto3.client(
        "s3",
        region_name=aws_region,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
    )


def cleanup_excel_files_before_date(cutoff_input, dry_run=False):
    """
    Delete excel_files rows with created_at < cutoff, and delete the S3 object
    (file_path) before deleting each DB row.
    """
    cutoff_dt = parse_cutoff_datetime(cutoff_input)
    bucket_name = os.getenv("AWS_S3_BUCKET_NAME", "snt-nhit-data")

    print("\n[excel_files cleanup]")
    print(f"  Cutoff: rows with created_at < {cutoff_dt}")
    print(f"  S3 bucket: {bucket_name}")
    print(f"  Dry run: {'Yes' if dry_run else 'No'}")

    db_config = get_db_config()
    conn = None
    cursor = None

    try:
        conn = psycopg2.connect(**db_config)
        conn.autocommit = False
        cursor = conn.cursor()
        cursor.execute("SET timezone = 'Asia/Kolkata'")

        select_query = """
            SELECT id, file_path, created_at
            FROM public.excel_files
            WHERE created_at < %s
            ORDER BY created_at ASC;
        """
        cursor.execute(select_query, (cutoff_dt,))
        rows = cursor.fetchall()

        if not rows:
            print("  No rows found for cleanup.")
            conn.rollback()
            return {"matched": 0, "deleted": 0, "failed": 0}

        print(f"  Matched rows: {len(rows)}")

        s3_client = None if dry_run else _build_s3_client()
        deleted = 0
        failed = 0

        for row_id, file_path, created_at in rows:
            try:
                if dry_run:
                    print(f"  [DRY RUN] id={row_id}, created_at={created_at}, key={file_path}")
                    deleted += 1
                    continue

                # Step 1: delete S3 object first (as requested)
                if file_path and file_path.strip():
                    s3_client.delete_object(Bucket=bucket_name, Key=file_path.strip())
                    print(f"  S3 deleted: {file_path}")
                else:
                    print(f"  Warning: Empty file_path for id={row_id}; continuing with row delete.")

                # Step 2: delete DB row
                cursor.execute("DELETE FROM public.excel_files WHERE id = %s;", (row_id,))
                conn.commit()
                deleted += 1
                print(f"  DB row deleted: id={row_id}")

            except Exception as row_error:
                failed += 1
                conn.rollback()
                print(f"  Failed id={row_id}: {row_error}")
                continue

        if dry_run:
            conn.rollback()
            print(f"  Dry run complete. Rows that would be deleted: {deleted}")
        else:
            print(f"  Cleanup complete. Deleted={deleted}, Failed={failed}")

        return {"matched": len(rows), "deleted": deleted, "failed": failed}

    except Exception as error:
        if conn:
            conn.rollback()
        print(f"\n❌ Cleanup failed: {error}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
            print("  Database connection closed.")

def get_db_config():
    """
    Returns database configuration from environment variables.
    """
    db_host = os.getenv('DB_HOST', 'localhost')
    is_localhost = db_host == 'localhost' or db_host == '127.0.0.1'
    
    config = {
        'host': db_host,
        'database': os.getenv('DB_NAME', 'ifc_dev'),
        'user': os.getenv('DB_USER', 'divyesh'),
        'password': os.getenv('DB_PASSWORD', '0548'),
        'port': int(os.getenv('DB_PORT', '5432'))
    }
    
    # Enable SSL for remote connections (AWS RDS requires SSL)
    # For psycopg2, we use ssl parameter with a dictionary
    if not is_localhost:
        config['sslmode'] = 'require'
        # Alternative: use ssl parameter (uncomment if sslmode doesn't work)
        # config['ssl'] = {'sslmode': 'require'}
    
    return config

    
def table_exists(cursor, table_name):
    """
    Checks if a table exists in the public schema.
    Returns True if table exists, False otherwise.
    """
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = %s
        );
    """, (table_name,))
    return cursor.fetchone()[0]

def constraint_exists(cursor, constraint_name):
    """
    Checks if a constraint exists.
    Returns True if constraint exists, False otherwise.
    """
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = %s
        );
    """, (constraint_name,))
    return cursor.fetchone()[0]

def create_table_with_constraint(cursor, table_name, create_table_query, constraint_name, add_constraint_query):
    """
    Helper function to create a table and its primary key constraint if they don't exist.
    """
    if table_exists(cursor, table_name):
        print(f"  ⚠️  Table '{table_name}' already exists. Skipping creation.")
    else:
        print(f"  Creating table '{table_name}'...")
        cursor.execute(create_table_query)
        print(f"  ✓ Table '{table_name}' created successfully!")
    
    if constraint_exists(cursor, constraint_name):
        print(f"  ⚠️  Constraint '{constraint_name}' already exists. Skipping.")
    else:
        print(f"  Adding primary key constraint '{constraint_name}'...")
        cursor.execute(add_constraint_query)
        print(f"  ✓ Constraint '{constraint_name}' added successfully!")

def create_companies_table(cursor):
    """Creates the companies table if it doesn't exist."""
    print("\n[companies]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.companies (
        id serial NOT NULL,
        company_identifier character varying(255) NULL,
        company_name character varying(255) NULL,
        registered_email character varying(255) NULL,
        registered_address text NULL,
        unique_identification_number character varying(255) NULL,
        gst character varying(255) NULL,
        pan character varying(255) NULL,
        number_of_corporate_offices character varying(255) NULL,
        number_of_factory_units character varying(255) NULL,
        created_at timestamp without time zone NULL DEFAULT (
            (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text
        )
    );
    """
    
    add_constraint_query = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'companies_pkey'
        ) THEN
            ALTER TABLE public.companies
            ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'companies', create_table_query, 'companies_pkey', add_constraint_query)

def create_control_forms_table(cursor):
    """Creates the control_forms table if it doesn't exist."""
    print("\n[control_forms]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.control_forms (
        id serial NOT NULL,
        description_of_control text NULL,
        process character varying(255) NULL,
        sub_process character varying(255) NULL,
        risk_description text NULL,
        whether_fraud_risks_exist character varying(255) NULL,
        control_objective text NULL,
        control_to_address text NULL,
        mrc_or_not character varying(255) NULL,
        source_data_report_logic_report_parameters text NULL,
        relevant_data_elements_of_ipe text NULL,
        type_of_control character varying(255) NULL,
        nature_of_control character varying(255) NULL,
        type_of_risk_mitigation_method character varying(255) NULL,
        process_owner character varying(255) NULL,
        reviewer_process_supervisor character varying(255) NULL,
        control_frequency character varying(255) NULL,
        due_date date NULL,
        reminder_frequency integer NULL,
        basis_of_sampling character varying(255) NULL,
        docs_to_review_for_dms_audit text NULL,
        type_of_risk_associated character varying(255) NULL,
        financial_reporting character varying(255) NULL,
        checks_performed text NULL,
        effective_or_not_effective character varying(255) NULL,
        done character varying(255) NULL,
        findings text NULL,
        doc_uploaded_by_user character varying(255) NULL,
        active character varying(255) NULL,
        status character varying(255) NULL,
        reason_by_approver text NULL,
        created_at timestamp without time zone NULL DEFAULT (
            CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text
        ),
        gap_description_resolution text NULL,
        company_identifier character varying(255) NULL,
        form_id character varying(255) NULL,
        remarks_by_user text NULL,
        business_process character varying(255) NULL,
        financial_year character varying(255) NULL,
        sample_required text NULL,
        completeness character varying(255) NULL,
        existence_occurrence character varying(255) NULL,
        rights_and_obligation character varying(255) NULL,
        valuation_and_allocation character varying(255) NULL,
        presentation_and_disclosure character varying(255) NULL
    );
    """
    
    add_constraint_query = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'control_forms_pkey'
        ) THEN
            ALTER TABLE public.control_forms
            ADD CONSTRAINT control_forms_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'control_forms', create_table_query, 'control_forms_pkey', add_constraint_query)

def create_excel_files_table(cursor):
    """Creates the excel_files table if it doesn't exist."""
    print("\n[excel_files]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.excel_files (
        id serial NOT NULL,
        file_path character varying(500) NOT NULL,
        file_name character varying(255) NOT NULL,
        processed integer NULL DEFAULT 0,
        created_at timestamp without time zone NULL DEFAULT (
            (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text
        ),
        company_identifier character varying(255) NULL,
        coordinator_email_id character varying(255) NULL,
        business_process character varying(255) NULL,
        financial_year character varying(255) NULL,
        due_date date NULL,
        reminder_frequency character varying(255) NULL
    );
    """
    
    add_constraint_query = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'excel_files_pkey'
        ) THEN
            ALTER TABLE public.excel_files
            ADD CONSTRAINT excel_files_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'excel_files', create_table_query, 'excel_files_pkey', add_constraint_query)

def create_ifc_users_table(cursor):
    """Creates the ifc_users table if it doesn't exist."""
    print("\n[ifc_users]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.ifc_users (
        id serial NOT NULL,
        email_id character varying(255) NOT NULL,
        password character varying(255) NOT NULL,
        role character varying(50) NOT NULL,
        created_at timestamp without time zone NULL DEFAULT (
            (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text
        ),
        temp_login integer NULL DEFAULT 0,
        company_identifier character varying(255) NULL
    );
    """
    
    add_constraint_query = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'ifc_users_pkey'
        ) THEN
            ALTER TABLE public.ifc_users
            ADD CONSTRAINT ifc_users_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'ifc_users', create_table_query, 'ifc_users_pkey', add_constraint_query)

def create_audit_logs_racm_table(cursor):
    """
    Creates audit_logs_racm: RACM-related audit rows (includes form_id, ref_data).
    Plain columns only — no primary key or other table constraints.
    """
    print("\n[audit_logs_racm]")

    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.audit_logs_racm (
        id serial,
        timestamp timestamp without time zone NULL DEFAULT (
            (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text
        ),
        action character varying(255) NULL,
        user_email_id character varying(255) NULL,
        form_id character varying(255) NULL,
        ref_data text NULL
    );
    """

    if table_exists(cursor, 'audit_logs_racm'):
        print("  ⚠️  Table 'audit_logs_racm' already exists. Skipping creation.")
    else:
        print("  Creating table 'audit_logs_racm'...")
        cursor.execute(create_table_query)
        print("  ✓ Table 'audit_logs_racm' created successfully!")


def create_audit_logs_table(cursor):
    """
    Creates audit_logs: core session/auth columns plus optional ref_data (text).
    Plain columns only — no primary key or other table constraints.
    """
    print("\n[audit_logs]")

    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.audit_logs (
        id serial,
        timestamp timestamp without time zone NULL DEFAULT (
            (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text
        ),
        action character varying(255) NULL,
        user_email_id character varying(255) NULL,
        ref_data text NULL
    );
    """

    if table_exists(cursor, 'audit_logs'):
        print("  ⚠️  Table 'audit_logs' already exists. Skipping creation.")
    else:
        print("  Creating table 'audit_logs'...")
        cursor.execute(create_table_query)
        print("  ✓ Table 'audit_logs' created successfully!")

def column_exists(cursor, table_name, column_name):
    """
    Checks if a column exists in a table.
    Returns True if column exists, False otherwise.
    """
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = %s
            AND column_name = %s
        );
    """, (table_name, column_name))
    return cursor.fetchone()[0]

def alter_audit_logs_racm_ensure_ref_data_text(cursor):
    """Ensure audit_logs_racm.ref_data exists and uses type TEXT."""
    print("\n[audit_logs_racm - ref_data as TEXT]")

    if not table_exists(cursor, 'audit_logs_racm'):
        print("  ⚠️  Table 'audit_logs_racm' does not exist. Skipping.")
        return

    if not column_exists(cursor, 'audit_logs_racm', 'ref_data'):
        print("  Adding column 'ref_data' (text) to 'audit_logs_racm'...")
        cursor.execute("""
            ALTER TABLE public.audit_logs_racm
            ADD COLUMN ref_data text NULL;
        """)
        print("  ✓ Column 'ref_data' added successfully!")
        return

    cursor.execute("""
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs_racm'
          AND column_name = 'ref_data';
    """)
    row = cursor.fetchone()
    if row and row[0] == 'text':
        print("  ⚠️  Column 'ref_data' is already TEXT. Skipping.")
        return

    print("  Altering column 'ref_data' to TEXT...")
    cursor.execute("""
        ALTER TABLE public.audit_logs_racm
        ALTER COLUMN ref_data TYPE text USING ref_data::text;
    """)
    print("  ✓ Column 'ref_data' is now TEXT.")

def alter_audit_logs_ensure_ref_data_text(cursor):
    """Ensure audit_logs.ref_data exists and uses type TEXT."""
    print("\n[audit_logs - ref_data as TEXT]")

    if not table_exists(cursor, 'audit_logs'):
        print("  ⚠️  Table 'audit_logs' does not exist. Skipping.")
        return

    if not column_exists(cursor, 'audit_logs', 'ref_data'):
        print("  Adding column 'ref_data' (text) to 'audit_logs'...")
        cursor.execute("""
            ALTER TABLE public.audit_logs
            ADD COLUMN ref_data text NULL;
        """)
        print("  ✓ Column 'ref_data' added successfully!")
        return

    cursor.execute("""
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND column_name = 'ref_data';
    """)
    row = cursor.fetchone()
    if row and row[0] == 'text':
        print("  ⚠️  Column 'ref_data' is already TEXT. Skipping.")
        return

    print("  Altering column 'ref_data' to TEXT...")
    cursor.execute("""
        ALTER TABLE public.audit_logs
        ALTER COLUMN ref_data TYPE text USING ref_data::text;
    """)
    print("  ✓ Column 'ref_data' is now TEXT.")

def insert_ifc_user(email_id, password, role, company_identifier=None, temp_login=0):
    """
    Inserts a new user into the ifc_users table.
    
    Args:
        email_id (str): User's email address (required)
        password (str): User's password (required)
        role (str): User's role - must be one of: 'user', 'company_co', 'approver', 'siteadmin', 'auditor' (required)
        company_identifier (str, optional): Company identifier for company_co and user roles
        temp_login (int, optional): Temporary login flag (0 or 1), defaults to 0
    
    Returns:
        dict: Dictionary containing the inserted user data with 'id', 'email_id', 'role', etc.
        None: If insertion fails
    
    Raises:
        ValueError: If required parameters are missing or role is invalid
        psycopg2.Error: If database operation fails
    """
    # Validate required parameters
    if not email_id or not password or not role:
        raise ValueError("email_id, password, and role are required parameters")
    
    # Validate role
    valid_roles = ['user', 'company_co', 'approver', 'siteadmin', 'auditor']
    if role not in valid_roles:
        raise ValueError(f"Invalid role '{role}'. Must be one of: {', '.join(valid_roles)}")
    
    # Validate temp_login
    if temp_login not in [0, 1]:
        raise ValueError("temp_login must be 0 or 1")
    
    db_config = get_db_config()
    conn = None
    
    try:
        # Connect to PostgreSQL database
        conn = psycopg2.connect(**db_config)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Set timezone to Asia/Kolkata
        cursor.execute("SET timezone = 'Asia/Kolkata'")
        
        # Check if user with this email already exists
        cursor.execute("""
            SELECT id FROM public.ifc_users 
            WHERE email_id = %s
        """, (email_id,))
        
        existing_user = cursor.fetchone()
        if existing_user:
            print(f"⚠️  User with email '{email_id}' already exists (ID: {existing_user[0]})")
            return None
        
        # Insert new user
        insert_query = """
            INSERT INTO public.ifc_users (email_id, password, role, company_identifier, temp_login)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, email_id, role, company_identifier, temp_login, created_at;
        """
        
        cursor.execute(insert_query, (email_id, password, role, company_identifier, temp_login))
        
        # Fetch the inserted row
        result = cursor.fetchone()
        
        if result:
            user_data = {
                'id': result[0],
                'email_id': result[1],
                'role': result[2],
                'company_identifier': result[3],
                'temp_login': result[4],
                'created_at': result[5]
            }
            print(f"✓ User '{email_id}' (role: {role}) inserted successfully with ID: {user_data['id']}")
            return user_data
        else:
            print(f"⚠️  Failed to insert user '{email_id}'")
            return None
            
    except psycopg2.IntegrityError as e:
        print(f"❌ Integrity error while inserting user: {e}")
        if conn:
            conn.rollback()
        raise
    except psycopg2.Error as e:
        print(f"❌ PostgreSQL error while inserting user: {e}")
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        print(f"❌ Unexpected error while inserting user: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            cursor.close()
            conn.close()

def create_sampling_process_temp_table(cursor):
    """Creates the sampling_process_temp table if it doesn't exist."""
    print("\n[sampling_process_temp]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.sampling_process_temp (
        id serial NOT NULL,
        excel_file_url character varying(500) NOT NULL,
        form_id character varying(255) NOT NULL,
        primary_columns character varying(500) NOT NULL,
        processed integer NULL DEFAULT 0
    );
    """
    
    add_constraint_query = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'sampling_process_temp_pkey'
        ) THEN
            ALTER TABLE public.sampling_process_temp
            ADD CONSTRAINT sampling_process_temp_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'sampling_process_temp', create_table_query, 'sampling_process_temp_pkey', add_constraint_query)

def alter_control_forms_add_sample_required(cursor):
    """Adds sample_required column to control_forms table if it doesn't exist."""
    print("\n[control_forms - Adding sample_required column]")
    
    if column_exists(cursor, 'control_forms', 'sample_required'):
        print("  ⚠️  Column 'sample_required' already exists in 'control_forms' table. Skipping.")
    else:
        print("  Adding column 'sample_required' to 'control_forms' table...")
        cursor.execute("""
            ALTER TABLE public.control_forms
            ADD COLUMN sample_required text NULL;
        """)
        print("  ✓ Column 'sample_required' added successfully!")

def alter_control_forms_sample_required_to_text(cursor):
    """Alters sample_required column from character varying(255) to text if needed."""
    print("\n[control_forms - Altering sample_required column type]")
    
    if not column_exists(cursor, 'control_forms', 'sample_required'):
        print("  ⚠️  Column 'sample_required' does not exist. Skipping.")
        return
    
    # Check current column type
    cursor.execute("""
        SELECT data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'control_forms'
        AND column_name = 'sample_required';
    """)
    
    result = cursor.fetchone()
    if result:
        current_type = result[0]
        max_length = result[1]
        
        # If it's character varying with a length limit, alter it to text
        if current_type == 'character varying' and max_length:
            print(f"  Current type: {current_type}({max_length}), changing to text...")
            cursor.execute("""
                ALTER TABLE public.control_forms
                ALTER COLUMN sample_required TYPE text;
            """)
            print("  ✓ Column 'sample_required' altered to text successfully!")
        elif current_type == 'text':
            print("  ✓ Column 'sample_required' is already of type text. No change needed.")
        else:
            print(f"  ⚠️  Column 'sample_required' has unexpected type: {current_type}. Skipping.")
    else:
        print("  ⚠️  Could not determine column type. Skipping.")

def alter_control_forms_add_new_columns(cursor):
    """Adds new columns (Completeness, Existence & Occurrence, etc.) to control_forms table if they don't exist."""
    print("\n[control_forms - Adding new columns]")
    
    new_columns = [
        ('completeness', 'character varying(255)'),
        ('existence_occurrence', 'character varying(255)'),
        ('rights_and_obligation', 'character varying(255)'),
        ('valuation_and_allocation', 'character varying(255)'),
        ('presentation_and_disclosure', 'character varying(255)')
    ]
    
    for column_name, column_type in new_columns:
        if column_exists(cursor, 'control_forms', column_name):
            print(f"  ⚠️  Column '{column_name}' already exists in 'control_forms' table. Skipping.")
        else:
            print(f"  Adding column '{column_name}' to 'control_forms' table...")
            cursor.execute(f"""
                ALTER TABLE public.control_forms
                ADD COLUMN {column_name} {column_type} NULL;
            """)
            print(f"  ✓ Column '{column_name}' added successfully!")

def alter_control_forms_add_due_date_and_reminder_frequency(cursor):
    """Adds due_date and reminder_frequency columns to control_forms table if they don't exist."""
    print("\n[control_forms - Adding due_date and reminder_frequency columns]")

    new_columns = [
        ('due_date', 'date'),
        ('reminder_frequency', 'integer')
    ]

    for column_name, column_type in new_columns:
        if column_exists(cursor, 'control_forms', column_name):
            print(f"  ⚠️  Column '{column_name}' already exists in 'control_forms' table. Skipping.")
        else:
            print(f"  Adding column '{column_name}' to 'control_forms' table...")
            cursor.execute(f"""
                ALTER TABLE public.control_forms
                ADD COLUMN {column_name} {column_type} NULL;
            """)
            print(f"  ✓ Column '{column_name}' added successfully!")

def alter_control_forms_add_reminder_datetime(cursor):
    """Adds reminder_datetime column to control_forms table if it doesn't exist.

    We store reminder_datetime as a "wall-clock" Asia/Kolkata timestamp (no time zone).
    """
    print("\n[control_forms - Adding reminder_datetime column]")

    column_name = 'reminder_datetime'
    column_type = 'timestamp without time zone'

    if column_exists(cursor, 'control_forms', column_name):
        print(f"  ⚠️  Column '{column_name}' already exists in 'control_forms' table. Skipping.")
        return

    print(f"  Adding column '{column_name}' to 'control_forms' table...")
    cursor.execute(f"""
        ALTER TABLE public.control_forms
        ADD COLUMN {column_name} {column_type} NULL;
    """)
    print(f"  ✓ Column '{column_name}' added successfully!")

def alter_control_forms_add_approval_status_change_timestamp(cursor):
    """Adds approval_status_change_timestamp column to control_forms if it doesn't exist.

    Same storage semantics as reminder_datetime: wall-clock timestamp without time zone
    (Asia/Kolkata when set via app defaults).
    """
    print("\n[control_forms - Adding approval_status_change_timestamp column]")

    column_name = 'approval_status_change_timestamp'
    column_type = 'timestamp without time zone'

    if column_exists(cursor, 'control_forms', column_name):
        print(f"  ⚠️  Column '{column_name}' already exists in 'control_forms' table. Skipping.")
        return

    print(f"  Adding column '{column_name}' to 'control_forms' table...")
    cursor.execute(f"""
        ALTER TABLE public.control_forms
        ADD COLUMN {column_name} {column_type} NULL;
    """)
    print(f"  ✓ Column '{column_name}' added successfully!")

def alter_control_forms_reminder_datetime_type_to_wall_clock_ist(cursor):
    """Converts reminder_datetime to `timestamp without time zone` in Asia/Kolkata wall-clock terms.

    This is a one-time migration for installations where reminder_datetime was previously created as `TIMESTAMP WITH TIME ZONE`.
    """
    print("\n[control_forms - Converting reminder_datetime to wall-clock IST]")

    if not column_exists(cursor, 'control_forms', 'reminder_datetime'):
        print("  ⚠️  Column 'reminder_datetime' does not exist. Skipping conversion.")
        return

    cursor.execute("""
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'control_forms'
          AND column_name = 'reminder_datetime';
    """)
    row = cursor.fetchone()
    if not row:
        print("  ⚠️  Could not read current reminder_datetime type. Skipping conversion.")
        return

    current_data_type = row[0]
    if current_data_type == 'timestamp without time zone':
        print("  ✓ reminder_datetime is already `timestamp without time zone`. No conversion needed.")
        return

    print(f"  Current type: {current_data_type}. Converting to timestamp without time zone...")
    cursor.execute("""
        ALTER TABLE public.control_forms
        ALTER COLUMN reminder_datetime
        TYPE timestamp without time zone
        USING reminder_datetime AT TIME ZONE 'Asia/Kolkata';
    """)
    print("  ✓ reminder_datetime type converted successfully.")

def alter_excel_files_add_due_date_and_reminder_frequency(cursor):
    """Adds due_date (date) and reminder_frequency (varchar) to excel_files if they don't exist."""
    print("\n[excel_files - Adding due_date and reminder_frequency columns]")

    if not table_exists(cursor, 'excel_files'):
        print("  ⚠️  Table 'excel_files' does not exist. Skipping.")
        return

    new_columns = [
        ('due_date', 'date'),
        ('reminder_frequency', 'character varying(255)'),
    ]

    for column_name, column_type in new_columns:
        if column_exists(cursor, 'excel_files', column_name):
            print(f"  ⚠️  Column '{column_name}' already exists in 'excel_files' table. Skipping.")
        else:
            print(f"  Adding column '{column_name}' to 'excel_files' table...")
            cursor.execute(f"""
                ALTER TABLE public.excel_files
                ADD COLUMN {column_name} {column_type} NULL;
            """)
            print(f"  ✓ Column '{column_name}' added successfully!")

def alter_sampling_process_temp_add_processed(cursor):
    """Adds processed column to sampling_process_temp table if it doesn't exist."""
    print("\n[sampling_process_temp - Adding processed column]")
    
    if column_exists(cursor, 'sampling_process_temp', 'processed'):
        print("  ⚠️  Column 'processed' already exists in 'sampling_process_temp' table. Skipping.")
    else:
        print("  Adding column 'processed' to 'sampling_process_temp' table...")
        cursor.execute("""
            ALTER TABLE public.sampling_process_temp
            ADD COLUMN processed integer NULL DEFAULT 0;
        """)
        print("  ✓ Column 'processed' added successfully!")

def alter_control_forms_ensure_control_frequency_varchar(cursor):
    """Ensures control_frequency column is VARCHAR(255) type in control_forms table."""
    print("\n[control_forms - Ensuring control_frequency is VARCHAR]")
    
    if not column_exists(cursor, 'control_forms', 'control_frequency'):
        print("  ⚠️  Column 'control_frequency' does not exist. Skipping.")
        return
    
    # Check current column type
    cursor.execute("""
        SELECT data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'control_forms'
        AND column_name = 'control_frequency';
    """)
    
    result = cursor.fetchone()
    if result:
        current_type = result[0]
        max_length = result[1]
        
        # If it's not character varying(255), alter it to varchar(255)
        if current_type != 'character varying' or max_length != 255:
            print(f"  Current type: {current_type}({max_length}), changing to character varying(255)...")
            cursor.execute("""
                ALTER TABLE public.control_forms
                ALTER COLUMN control_frequency TYPE character varying(255);
            """)
            print("  ✓ Column 'control_frequency' altered to character varying(255) successfully!")
        else:
            print("  ✓ Column 'control_frequency' is already character varying(255). No change needed.")
    else:
        print("  ⚠️  Could not determine column type. Skipping.")

def create_control_form_history_table(cursor):
    """Creates the control_form_history table if it doesn't exist."""
    print("\n[control_form_history]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.control_form_history (
        id serial NOT NULL,
        form_id character varying(255) NULL,
        doc_uploaded_by_user character varying(500) NULL,
        reason_by_approver text NULL
    );
    """
    
    add_constraint_query = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'control_form_history_pkey'
        ) THEN
            ALTER TABLE public.control_form_history
            ADD CONSTRAINT control_form_history_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'control_form_history', create_table_query, 'control_form_history_pkey', add_constraint_query)

def create_all_tables():
    """
    Main function that creates all tables in the database.
    """
    db_config = get_db_config()
    
    # Display connection info
    print("=" * 70)
    print("PostgreSQL Table Creation Script")
    print("=" * 70)
    print(f"Host: {db_config['host']}")
    print(f"Database: {db_config['database']}")
    print(f"User: {db_config['user']}")
    print(f"Port: {db_config['port']}")
    print("=" * 70)
    
    conn = None
    try:
        # Connect to PostgreSQL database
        print(f"\nConnecting to database '{db_config['database']}'...")
        conn = psycopg2.connect(**db_config)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Set timezone to Asia/Kolkata
        cursor.execute("SET timezone = 'Asia/Kolkata'")
        
        # Create all tables
        print("\n" + "=" * 70)
        print("Creating tables...")
        print("=" * 70)
    
        # create_companies_table(cursor)
        # create_control_forms_table(cursor)
        # create_excel_files_table(cursor)
        # create_ifc_users_table(cursor)
        # create_audit_logs_racm_table(cursor)
        # create_audit_logs_table(cursor)
        # alter_audit_logs_ensure_ref_data_text(cursor)
        # create_sampling_process_temp_table(cursor)
        # create_control_form_history_table(cursor)
        # alter_audit_logs_racm_ensure_ref_data_text(cursor)
        # alter_control_forms_add_sample_required(cursor)
        # alter_control_forms_sample_required_to_text(cursor)
        # alter_control_forms_add_new_columns(cursor)
        # alter_control_forms_add_due_date_and_reminder_frequency(cursor)
        # alter_control_forms_add_reminder_datetime(cursor)
        alter_control_forms_add_approval_status_change_timestamp(cursor)
        # alter_excel_files_add_due_date_and_reminder_frequency(cursor)
        # alter_control_forms_reminder_datetime_type_to_wall_clock_ist(cursor)
        # alter_control_forms_ensure_control_frequency_varchar(cursor)
        # alter_sampling_process_temp_add_processed(cursor)
        
        print("\n" + "=" * 70)
        print("✓ All tables processed successfully!")
        print("=" * 70)
        
        # List all created tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        if tables:
            print("\nTables in database:")
            print("-" * 70)
            for table in tables:
                print(f"  ✓ {table[0]}")
        
        cursor.close()
        
    except psycopg2.OperationalError as e:
        error_msg = str(e)
        print(f"\n❌ Database connection error: {e}")
        
        # Check if it's a "database does not exist" error
        if "does not exist" in error_msg.lower():
            print(f"\n⚠️  The database '{db_config['database']}' does not exist on the server.")
            print("\n   The script attempted to create it automatically but failed.")
            print("\n   To fix this, you have two options:")
            print("\n   Option 1: Create the database manually using psql:")
            print(f"     psql -h {db_config['host']} -U {db_config['user']} -p {db_config['port']} -d postgres")
            print(f"     CREATE DATABASE {db_config['database']};")
            print("\n   Option 2: Update your .env file to use an existing database:")
            print("     DB_NAME=ifc_dev  (or another existing database name)")
            print("\n   To list available databases, connect to 'postgres' database:")
            print(f"     psql -h {db_config['host']} -U {db_config['user']} -p {db_config['port']} -d postgres -c '\\l'")
        
        # Check if it's an authentication error
        elif "password authentication failed" in error_msg.lower() or "authentication failed" in error_msg.lower():
            print("\n⚠️  Authentication failed. Please check your DB_USER and DB_PASSWORD in .env file.")
        
        # Check if it's a connection error
        elif "could not connect" in error_msg.lower() or "connection refused" in error_msg.lower():
            print(f"\n⚠️  Could not connect to the database server.")
            print(f"  Please verify that:")
            print(f"    - The database server is running")
            print(f"    - DB_HOST ({db_config['host']}) is correct")
            print(f"    - DB_PORT ({db_config['port']}) is correct")
            print(f"    - Your network/firewall allows connections to this host")
        
        if conn:
            conn.rollback()
        raise
    
    except psycopg2.Error as e:
        print(f"\n❌ PostgreSQL error: {e}")
        if conn:
            conn.rollback()
        raise
    
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        if conn:
            conn.rollback()
        raise
    
    finally:
        if conn:
            conn.close()
            print("\nDatabase connection closed.")




if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Database utilities for IFC backend")
    parser.add_argument(
        "--cleanup-excel-files-before",
        dest="cleanup_excel_files_before",
        help=(
            "Delete rows from excel_files where created_at is older than the given "
            "date/datetime. Format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS[.ffffff]"
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview rows/S3 keys to delete without deleting anything.",
    )
    args = parser.parse_args()

    if args.cleanup_excel_files_before:
        cleanup_excel_files_before_date(args.cleanup_excel_files_before, dry_run=args.dry_run)
    else:
        create_all_tables()
