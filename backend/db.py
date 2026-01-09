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

def create_auditors_table(cursor):
    """Creates the auditors table if it doesn't exist."""
    print("\n[auditors]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.auditors (
        id serial NOT NULL,
        email_id character varying(255) NOT NULL,
        password character varying(255) NOT NULL,
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
            WHERE conname = 'auditors_pkey'
        ) THEN
            ALTER TABLE public.auditors
            ADD CONSTRAINT auditors_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'auditors', create_table_query, 'auditors_pkey', add_constraint_query)

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
        remarks_by_user text NULL
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
        company_identifier character varying(255) NULL
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

def create_siteadmin_table(cursor):
    """Creates the siteadmin table if it doesn't exist."""
    print("\n[siteadmin]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.siteadmin (
        id serial NOT NULL,
        email_id character varying(255) NOT NULL,
        password character varying(255) NOT NULL,
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
            WHERE conname = 'siteadmin_pkey'
        ) THEN
            ALTER TABLE public.siteadmin
            ADD CONSTRAINT siteadmin_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'siteadmin', create_table_query, 'siteadmin_pkey', add_constraint_query)

def create_appover_table(cursor):
    """Creates the appover table if it doesn't exist."""
    print("\n[appover]")
    
    create_table_query = """
    CREATE TABLE IF NOT EXISTS public.appover (
        id serial NOT NULL,
        email_id character varying(255) NOT NULL,
        password character varying(255) NOT NULL,
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
            WHERE conname = 'appover_pkey'
        ) THEN
            ALTER TABLE public.appover
            ADD CONSTRAINT appover_pkey PRIMARY KEY (id);
        END IF;
    END $$;
    """
    
    create_table_with_constraint(cursor, 'appover', create_table_query, 'appover_pkey', add_constraint_query)

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
        
        create_auditors_table(cursor)
        create_companies_table(cursor)
        create_control_forms_table(cursor)
        create_excel_files_table(cursor)
        create_ifc_users_table(cursor)
        create_siteadmin_table(cursor)
        create_appover_table(cursor)
        
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

def add_appover_row(email_id, password):
    """
    Adds a new row to the appover table.
    
    Args:
        email_id (str): Email ID of the approver
        password (str): Password for the approver
    
    Returns:
        dict: Dictionary containing the inserted row data (id, email_id, created_at)
        None: If insertion failed or email already exists
    
    Raises:
        psycopg2.Error: If database error occurs
    """
    db_config = get_db_config()
    conn = None
    
    try:
        conn = psycopg2.connect(**db_config)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Set timezone to Asia/Kolkata
        cursor.execute("SET timezone = 'Asia/Kolkata'")
        
        # Check if email already exists
        cursor.execute("""
            SELECT id FROM public.appover WHERE email_id = %s
        """, (email_id,))
        
        if cursor.fetchone():
            print(f"⚠️  Email '{email_id}' already exists in appover table.")
            return None
        
        # Insert new row
        cursor.execute("""
            INSERT INTO public.appover (email_id, password)
            VALUES (%s, %s)
            RETURNING id, email_id, created_at
        """, (email_id, password))
        
        result = cursor.fetchone()
        inserted_row = {
            'id': result[0],
            'email_id': result[1],
            'created_at': result[2]
        }
        
        print(f"✓ Successfully added approver: {email_id} (ID: {inserted_row['id']})")
        cursor.close()
        return inserted_row
        
    except psycopg2.IntegrityError as e:
        print(f"❌ Integrity error: {e}")
        if conn:
            conn.rollback()
        return None
    
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
        raise
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        if conn:
            conn.rollback()
        raise
    
    finally:
        if conn:
            conn.close()

def add_auditor_row(email_id, password):
    """
    Adds a new row to the auditors table.
    
    Args:
        email_id (str): Email ID of the auditor
        password (str): Password for the auditor
    
    Returns:
        dict: Dictionary containing the inserted row data (id, email_id, created_at)
        None: If insertion failed or email already exists
    
    Raises:
        psycopg2.Error: If database error occurs
    """
    db_config = get_db_config()
    conn = None
    
    try:
        conn = psycopg2.connect(**db_config)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Set timezone to Asia/Kolkata
        cursor.execute("SET timezone = 'Asia/Kolkata'")
        
        # Check if email already exists
        cursor.execute("""
            SELECT id FROM public.auditors WHERE email_id = %s
        """, (email_id,))
        
        if cursor.fetchone():
            print(f"⚠️  Email '{email_id}' already exists in auditors table.")
            return None
        
        # Insert new row
        cursor.execute("""
            INSERT INTO public.auditors (email_id, password)
            VALUES (%s, %s)
            RETURNING id, email_id, created_at
        """, (email_id, password))
        
        result = cursor.fetchone()
        inserted_row = {
            'id': result[0],
            'email_id': result[1],
            'created_at': result[2]
        }
        
        print(f"✓ Successfully added auditor: {email_id} (ID: {inserted_row['id']})")
        cursor.close()
        return inserted_row
        
    except psycopg2.IntegrityError as e:
        print(f"❌ Integrity error: {e}")
        if conn:
            conn.rollback()
        return None
    
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
        raise
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        if conn:
            conn.rollback()
        raise
    
    finally:
        if conn:
            conn.close()

def add_siteadmin_row(email_id, password):
    """
    Adds a new row to the siteadmin table.
    
    Args:
        email_id (str): Email ID of the site admin
        password (str): Password for the site admin
    
    Returns:
        dict: Dictionary containing the inserted row data (id, email_id, created_at)
        None: If insertion failed or email already exists
    
    Raises:
        psycopg2.Error: If database error occurs
    """
    db_config = get_db_config()
    conn = None
    
    try:
        conn = psycopg2.connect(**db_config)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Set timezone to Asia/Kolkata
        cursor.execute("SET timezone = 'Asia/Kolkata'")
        
        # Check if email already exists
        cursor.execute("""
            SELECT id FROM public.siteadmin WHERE email_id = %s
        """, (email_id,))
        
        if cursor.fetchone():
            print(f"⚠️  Email '{email_id}' already exists in siteadmin table.")
            return None
        
        # Insert new row
        cursor.execute("""
            INSERT INTO public.siteadmin (email_id, password)
            VALUES (%s, %s)
            RETURNING id, email_id, created_at
        """, (email_id, password))
        
        result = cursor.fetchone()
        inserted_row = {
            'id': result[0],
            'email_id': result[1],
            'created_at': result[2]
        }
        
        print(f"✓ Successfully added site admin: {email_id} (ID: {inserted_row['id']})")
        cursor.close()
        return inserted_row
        
    except psycopg2.IntegrityError as e:
        print(f"❌ Integrity error: {e}")
        if conn:
            conn.rollback()
        return None
    
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
        raise
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        if conn:
            conn.rollback()
        raise
    
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    # create_all_tables()
    # Add an approver
    result = add_appover_row("approver@example.com", "password123")
    
    # Add an auditor
    result = add_auditor_row("auditor@example.com", "password123")
    
    # Add a site admin
    result = add_siteadmin_row("admin@example.com", "password123")
