import os
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
        cycle character varying(255) NULL,
        sampling_doc character varying(255) NULL
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
        cycle character varying(255) NULL,
        financial_year character varying(255) NULL
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

def create_audit_logs_table(cursor):
    """Creates the audit_logs table if it doesn't exist."""
    print("\n[audit_logs]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.audit_logs (
        id serial NOT NULL,
        timestamp timestamp without time zone NULL DEFAULT (
            (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text
        ),
        action character varying(255) NULL,
        user_email_id character varying(255) NULL,
        form_id character varying(255) NULL
    );
    """
    
    add_constraint_query = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'audit_logs_pkey'
        ) THEN
            ALTER TABLE public.audit_logs
            ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'audit_logs', create_table_query, 'audit_logs_pkey', add_constraint_query)

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

def alter_audit_logs_add_form_id(cursor):
    """Adds form_id column to audit_logs table if it doesn't exist."""
    print("\n[audit_logs - Adding form_id column]")
    
    if column_exists(cursor, 'audit_logs', 'form_id'):
        print("  ⚠️  Column 'form_id' already exists in 'audit_logs' table. Skipping.")
    else:
        print("  Adding column 'form_id' to 'audit_logs' table...")
        cursor.execute("""
            ALTER TABLE public.audit_logs
            ADD COLUMN form_id character varying(255) NULL;
        """)
        print("  ✓ Column 'form_id' added successfully!")

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

def alter_control_forms_add_sampling_doc(cursor):
    """Adds sampling_doc column to control_forms table if it doesn't exist."""
    print("\n[control_forms - Adding sampling_doc column]")
    
    if column_exists(cursor, 'control_forms', 'sampling_doc'):
        print("  ⚠️  Column 'sampling_doc' already exists in 'control_forms' table. Skipping.")
    else:
        print("  Adding column 'sampling_doc' to 'control_forms' table...")
        cursor.execute("""
            ALTER TABLE public.control_forms
            ADD COLUMN sampling_doc character varying(255) NULL;
        """)
        print("  ✓ Column 'sampling_doc' added successfully!")

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

def alter_ifc_users_table(cursor):
    """Alters the ifc_users table to add new columns."""
    print("\n[alter_ifc_users]")

    alter_table_query = """
    ALTER TABLE public.ifc_users
    ADD COLUMN IF NOT EXISTS emp_code character varying(255) NULL,
    ADD COLUMN IF NOT EXISTS emp_name character varying(255) NULL,
    ADD COLUMN IF NOT EXISTS designation character varying(255) NULL,
    ADD COLUMN IF NOT EXISTS department character varying(255) NULL,
    ADD COLUMN IF NOT EXISTS mobile character varying(255) NULL;
    """
    
    # Execute the query to alter the table
    cursor.execute(alter_table_query)
    print("Table 'ifc_users' altered successfully with new columns.")

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
    
        create_companies_table(cursor)
        create_control_forms_table(cursor)
        create_excel_files_table(cursor)
        create_ifc_users_table(cursor)
        create_audit_logs_table(cursor)
        create_sampling_process_temp_table(cursor)
        alter_audit_logs_add_form_id(cursor)
        alter_control_forms_add_sampling_doc(cursor)
        alter_sampling_process_temp_add_processed(cursor)
        alter_ifc_users_table(cursor)
        
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
    create_all_tables()
