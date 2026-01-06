import psycopg2

# Database connection parameters
DB_NAME = "ifc_dev"
DB_USER = "divyesh"  # Change if your PostgreSQL user is different
DB_PASSWORD = "0548"  # Add your PostgreSQL password if required
DB_HOST = "localhost"
DB_PORT = "5432"

def get_connection():
    """Creates and returns a database connection with IST timezone"""
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        # Set timezone to IST (Asia/Kolkata)
        cur = conn.cursor()
        cur.execute("SET timezone = 'Asia/Kolkata'")
        conn.commit()
        cur.close()
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to database: {e}")
        return None

def add_siteadmin(email_id, password):
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Insert query
        insert_query = """
        INSERT INTO siteadmin (email_id, password)
        VALUES (%s, %s)
        RETURNING id;
        """
        
        cur.execute(insert_query, (email_id, password))
        
        # Get the inserted row's ID
        inserted_id = cur.fetchone()[0]
        
        # Commit the transaction
        conn.commit()
        
        print(f"Site admin added successfully! ID: {inserted_id}")
        cur.close()
        return True
        
    except psycopg2.IntegrityError as e:
        print(f"Error: Email ID '{email_id}' already exists in the database.")
        if conn:
            conn.rollback()
        return False
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def create_ifc_users_table():
    """
    Creates the 'ifc_users' table in the PostgreSQL database 'ifc_dev'
    with columns: email_id, password, role, created_at
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Create the ifc_users table
        create_table_query = """
        CREATE TABLE IF NOT EXISTS ifc_users (
            id SERIAL PRIMARY KEY,
            email_id VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
        );
        """
        
        cur.execute(create_table_query)
        
        # Commit the transaction
        conn.commit()
        
        print("Table 'ifc_users' created successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error creating table: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def add_ifc_user(email_id, password, role):
    """
    Adds a new row to the ifc_users table
    
    Args:
        email_id (str): Email ID of the user
        password (str): Password of the user
        role (str): Role of the user
    
    Returns:
        bool: True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Insert query
        insert_query = """
        INSERT INTO ifc_users (email_id, password, role)
        VALUES (%s, %s, %s)
        RETURNING id;
        """
        
        cur.execute(insert_query, (email_id, password, role))
        
        # Get the inserted row's ID
        inserted_id = cur.fetchone()[0]
        
        # Commit the transaction
        conn.commit()
        
        print(f"IFC user added successfully! ID: {inserted_id}")
        cur.close()
        return True
        
    except psycopg2.IntegrityError as e:
        print(f"Error: Email ID '{email_id}' already exists in the database.")
        if conn:
            conn.rollback()
        return False
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def add_temp_login_column():
    """
    Adds the 'temp_login' column to the 'ifc_users' table
    with default value 0 and datatype INTEGER
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Add the temp_login column
        alter_table_query = """
        ALTER TABLE ifc_users 
        ADD COLUMN IF NOT EXISTS temp_login INTEGER DEFAULT 0;
        """
        
        cur.execute(alter_table_query)
        
        # Commit the transaction
        conn.commit()
        
        print("Column 'temp_login' added successfully to 'ifc_users' table!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error adding column: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def create_auditors_table():
    """
    Creates the 'auditors' table in the PostgreSQL database 'ifc_dev'
    with the same structure as 'siteadmin' table
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Create the auditors table
        create_table_query = """
        CREATE TABLE IF NOT EXISTS auditors (
            id SERIAL PRIMARY KEY,
            email_id VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
        );
        """
        
        cur.execute(create_table_query)
        
        # Commit the transaction
        conn.commit()
        
        print("Table 'auditors' created successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error creating table: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def create_appover_table():
    """
    Creates the 'appover' table in the PostgreSQL database 'ifc_dev'
    with the same structure as 'siteadmin' table
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Create the appover table
        create_table_query = """
        CREATE TABLE IF NOT EXISTS appover (
            id SERIAL NOT NULL,
            email_id VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT (
                (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text
            ),
            CONSTRAINT appover_pkey PRIMARY KEY (id)
        );
        """
        
        cur.execute(create_table_query)
        
        # Commit the transaction
        conn.commit()
        
        print("Table 'appover' created successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error creating table: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def add_appover(email_id, password):
    """
    Adds a new row to the appover table
    
    Args:
        email_id (str): Email ID of the approver
        password (str): Password of the approver
    
    Returns:
        bool: True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Insert query
        insert_query = """
        INSERT INTO appover (email_id, password)
        VALUES (%s, %s)
        RETURNING id;
        """
        
        cur.execute(insert_query, (email_id, password))
        
        # Get the inserted row's ID
        inserted_id = cur.fetchone()[0]
        
        # Commit the transaction
        conn.commit()
        
        print(f"Approver added successfully! ID: {inserted_id}")
        cur.close()
        return True
        
    except psycopg2.IntegrityError as e:
        print(f"Error: Email ID '{email_id}' already exists in the database.")
        if conn:
            conn.rollback()
        return False
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def add_auditor(email_id, password):
    """
    Adds a new row to the auditors table
    
    Args:
        email_id (str): Email ID of the auditor
        password (str): Password of the auditor
    
    Returns:
        bool: True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Insert query
        insert_query = """
        INSERT INTO auditors (email_id, password)
        VALUES (%s, %s)
        RETURNING id;
        """
        
        cur.execute(insert_query, (email_id, password))
        
        # Get the inserted row's ID
        inserted_id = cur.fetchone()[0]
        
        # Commit the transaction
        conn.commit()
        
        print(f"Auditor added successfully! ID: {inserted_id}")
        cur.close()
        return True
        
    except psycopg2.IntegrityError as e:
        print(f"Error: Email ID '{email_id}' already exists in the database.")
        if conn:
            conn.rollback()
        return False
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def create_companies_table():
    """
    Creates the 'companies' table in the PostgreSQL database 'ifc_dev'
    with columns: Company_identifier, Company Name, Registered Email, Registered Address,
    Unique Identification Number, GST, PAN, Number of Corporate Offices,
    Number of Factory Unit/Warehouse/Other, Company Coordinator Email
    All columns are VARCHAR (string) datatype
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Create the companies table
        create_table_query = """
        CREATE TABLE IF NOT EXISTS companies (
            id SERIAL PRIMARY KEY,
            company_identifier VARCHAR(255),
            company_name VARCHAR(255),
            registered_email VARCHAR(255),
            registered_address TEXT,
            unique_identification_number VARCHAR(255),
            gst VARCHAR(255),
            pan VARCHAR(255),
            number_of_corporate_offices VARCHAR(255),
            number_of_factory_units VARCHAR(255),
            created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
        );
        """
        
        cur.execute(create_table_query)
        
        # Commit the transaction
        conn.commit()
        
        print("Table 'companies' created successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error creating table: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def add_company(company_identifier, company_name, registered_email, registered_address, 
                unique_identification_number, gst, pan, number_of_corporate_offices, 
                number_of_factory_units):
    """
    Adds a new row to the companies table
    
    Args:
        company_identifier (str): Company identifier
        company_name (str): Company name
        registered_email (str): Registered email
        registered_address (str): Registered address
        unique_identification_number (str): Unique identification number
        gst (str): GST number
        pan (str): PAN number
        number_of_corporate_offices (str): Number of corporate offices
        number_of_factory_units (str): Number of factory units/warehouse/other
    
    Returns:
        bool: True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Insert query
        insert_query = """
        INSERT INTO companies (
            company_identifier, company_name, registered_email, registered_address,
            unique_identification_number, gst, pan, number_of_corporate_offices,
            number_of_factory_units
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """
        
        cur.execute(insert_query, (
            company_identifier, company_name, registered_email, registered_address,
            unique_identification_number, gst, pan, number_of_corporate_offices,
            number_of_factory_units
        ))
        
        # Get the inserted row's ID
        inserted_id = cur.fetchone()[0]
        
        # Commit the transaction
        conn.commit()
        
        print(f"Company added successfully! ID: {inserted_id}")
        cur.close()
        return True
        
    except psycopg2.IntegrityError as e:
        print(f"Error: {e}")
        if conn:
            conn.rollback()
        return False
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def update_timestamp_defaults_to_ist():
    """
    Updates the DEFAULT value for created_at columns in all tables to use IST timezone
    This function updates existing tables to use IST instead of UTC/GMT
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # List of tables and their created_at columns
        tables = ['siteadmin', 'ifc_users', 'auditors', 'companies', 'control_forms']
        
        for table in tables:
            try:
                # Check if table exists and has created_at column
                check_query = """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s AND column_name = 'created_at'
                """
                cur.execute(check_query, (table,))
                if cur.fetchone():
                    # Update the default value to use IST
                    alter_query = f"""
                    ALTER TABLE {table} 
                    ALTER COLUMN created_at 
                    SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
                    """
                    cur.execute(alter_query)
                    print(f"Updated created_at default to IST for table '{table}'")
            except psycopg2.Error as e:
                print(f"Error updating table '{table}': {e}")
                continue
        
        # Commit the transaction
        conn.commit()
        
        print("All timestamp defaults updated to IST successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error updating timestamp defaults: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def remove_company_coordinator_email_column():
    """
    Removes the 'company_coordinator_email' column from the 'companies' table
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Drop the company_coordinator_email column
        alter_table_query = """
        ALTER TABLE companies 
        DROP COLUMN IF EXISTS company_coordinator_email;
        """
        
        cur.execute(alter_table_query)
        
        # Commit the transaction
        conn.commit()
        
        print("Column 'company_coordinator_email' removed successfully from 'companies' table!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error removing column: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def create_control_forms_table():
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Create the control_forms table
        create_table_query = """
        CREATE TABLE IF NOT EXISTS control_forms (
            id SERIAL PRIMARY KEY,
            description_of_control VARCHAR(255),
            process VARCHAR(255),
            sub_process VARCHAR(255),
            risk_description VARCHAR(255),
            whether_fraud_risks_exist VARCHAR(255),
            control_objective VARCHAR(255),
            control_to_address VARCHAR(255),
            mrc_or_not VARCHAR(255),
            source_data_report_logic_report_parameters TEXT,
            relevant_data_elements_of_ipe VARCHAR(255),
            type_of_control VARCHAR(255),
            nature_of_control VARCHAR(255),
            type_of_risk_mitigation_method VARCHAR(255),
            process_owner VARCHAR(255),
            reviewer_process_supervisor VARCHAR(255),
            control_frequency VARCHAR(255),
            basis_of_sampling VARCHAR(255),
            docs_to_review_for_dms_audit VARCHAR(255),
            type_of_risk_associated VARCHAR(255),
            financial_reporting VARCHAR(255),
            checks_performed VARCHAR(255),
            effective_or_not_effective VARCHAR(255),
            done VARCHAR(255),
            findings TEXT,
            gap_description_resolution VARCHAR(255),
            doc_uploaded_by_user VARCHAR(255),
            active VARCHAR(255),
            approved_rejected VARCHAR(255),
            reason_by_approver VARCHAR(255),
            company_identifier VARCHAR(255),
            form_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
        );
        """
        
        cur.execute(create_table_query)
        
        # Commit the transaction
        conn.commit()
        
        print("Table 'control_forms' created successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error creating table: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def fix_control_forms_created_at_default():
    """
    Fixes the created_at default value in control_forms table to correctly use Asia/Kolkata timezone
    This function updates the existing default value to use the correct timezone conversion
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Check if table exists and has created_at column
        check_query = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'control_forms' AND column_name = 'created_at'
        """
        cur.execute(check_query)
        if cur.fetchone():
            # Update the default value to use IST correctly
            alter_query = """
            ALTER TABLE control_forms 
            ALTER COLUMN created_at 
            SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
            """
            cur.execute(alter_query)
            print("Updated created_at default to IST for table 'control_forms'")
        else:
            print("Table 'control_forms' or column 'created_at' does not exist")
        
        # Commit the transaction
        conn.commit()
        
        print("Control forms created_at default fixed successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error fixing control_forms created_at default: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def create_excel_files_table():
    """
    Creates the 'excel_files' table to store paths of uploaded Excel files
    with a 'processed' column (default 0) to track processing status
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Create the excel_files table
        create_table_query = """
        CREATE TABLE IF NOT EXISTS excel_files (
            id SERIAL PRIMARY KEY,
            file_path VARCHAR(500) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            processed INTEGER DEFAULT 0,
            company_identifier VARCHAR(255)
        );
        """
        
        cur.execute(create_table_query)
        
        # Commit the transaction
        conn.commit()
        
        print("Table 'excel_files' created successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error creating table: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def alter_control_forms_columns_to_text():
    """
    Alters VARCHAR(255) columns in control_forms table to TEXT type
    for columns that may contain long text content.
    Also adds company_identifier and form_id columns if they don't exist.
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Columns that may contain long text and should be changed to TEXT
        columns_to_alter = [
            'description_of_control',
            'risk_description',
            'control_objective',
            'control_to_address',
            'relevant_data_elements_of_ipe',
            'docs_to_review_for_dms_audit',
            'checks_performed',
            'gap_description_resolution',
            'reason_by_approver'
        ]
        
        for column in columns_to_alter:
            try:
                alter_query = f"""
                ALTER TABLE control_forms 
                ALTER COLUMN {column} TYPE TEXT;
                """
                cur.execute(alter_query)
                print(f"Column '{column}' altered to TEXT successfully!")
            except psycopg2.Error as e:
                print(f"Error altering column '{column}': {e}")
                continue
        
        # Add company_identifier column if it doesn't exist
        try:
            check_column_query = """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'control_forms' 
            AND column_name = 'company_identifier';
            """
            cur.execute(check_column_query)
            if not cur.fetchone():
                alter_table_query = """
                ALTER TABLE control_forms 
                ADD COLUMN company_identifier VARCHAR(255);
                """
                cur.execute(alter_table_query)
                print("Column 'company_identifier' added successfully!")
            else:
                print("Column 'company_identifier' already exists.")
        except psycopg2.Error as e:
            print(f"Error adding company_identifier column: {e}")
        
        # Add form_id column if it doesn't exist
        try:
            check_column_query = """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'control_forms' 
            AND column_name = 'form_id';
            """
            cur.execute(check_column_query)
            if not cur.fetchone():
                alter_table_query = """
                ALTER TABLE control_forms 
                ADD COLUMN form_id VARCHAR(255);
                """
                cur.execute(alter_table_query)
                print("Column 'form_id' added successfully!")
            else:
                print("Column 'form_id' already exists.")
        except psycopg2.Error as e:
            print(f"Error adding form_id column: {e}")
        
        # Commit the transaction
        conn.commit()
        
        print("All columns altered successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error altering columns: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def remove_excel_files_columns():
    """
    Removes specified columns from the 'excel_files' table
    Columns to remove: file_size, uploaded_by, processed_at, error_message, records_imported
    Also adds company_identifier column if it doesn't exist
    """
    conn = None
    try:
        conn = get_connection()
        if not conn:
            return False
        
        cur = conn.cursor()
        
        # Columns to remove (checking for both possible spellings)
        columns_to_remove = [
            'file_size',
            'uploaded_by',
            'processed_at',
            'proccessed_at',  # In case of typo
            'error_message',
            'records_imported',
            'records_importted'  # In case of typo
        ]
        
        for column in columns_to_remove:
            try:
                # Check if column exists before trying to drop it
                check_column_query = """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'excel_files' 
                AND column_name = %s;
                """
                cur.execute(check_column_query, (column,))
                if cur.fetchone():
                    alter_query = f"""
                    ALTER TABLE excel_files 
                    DROP COLUMN IF EXISTS {column};
                    """
                    cur.execute(alter_query)
                    print(f"Column '{column}' removed successfully from 'excel_files' table!")
                else:
                    print(f"Column '{column}' does not exist in 'excel_files' table, skipping...")
            except psycopg2.Error as e:
                print(f"Error removing column '{column}': {e}")
                continue
        
        # Add company_identifier column if it doesn't exist
        try:
            check_column_query = """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'excel_files' 
            AND column_name = 'company_identifier';
            """
            cur.execute(check_column_query)
            if not cur.fetchone():
                alter_table_query = """
                ALTER TABLE excel_files 
                ADD COLUMN company_identifier VARCHAR(255);
                """
                cur.execute(alter_table_query)
                print("Column 'company_identifier' added successfully to 'excel_files' table!")
            else:
                print("Column 'company_identifier' already exists in 'excel_files' table.")
        except psycopg2.Error as e:
            print(f"Error adding company_identifier column: {e}")
        
        # Commit the transaction
        conn.commit()
        
        print("All specified columns removed and company_identifier added successfully!")
        cur.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error removing columns: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    # Create ifc_users table
    # create_ifc_users_table()
    
    # Create auditors table
    # create_auditors_table()
    
    # Create appover table
    # create_appover_table()
    add_appover("appover@gmail.com", "123456")
    
    # Create companies table
    # create_companies_table()
    
    # Create control_forms table
    # create_control_forms_table()
    
    # Add gap_description_resolution column to control_forms table
    # add_gap_description_resolution_column()

    # fix_control_forms_created_at_default()
    
    # Add company_identifier column to control_forms table
    # add_company_identifier_column()
    
    # Remove columns from excel_files table and add company_identifier
    # remove_excel_files_columns()
    
    # Create excel_files table
    # create_excel_files_table()
    
    # Add temp_login column to ifc_users table
    # add_temp_login_column()
    
    # Update timestamp defaults to IST (run this once to update existing tables)
    # update_timestamp_defaults_to_ist()
    
    # Remove company_coordinator_email column from companies table
    # remove_company_coordinator_email_column()
    
    # Example usage for siteadmin
    # add_siteadmin("siteadmin@gmail.com", "password123")
    
    # Example usage for auditors
    # add_auditor("auditor@example.com", "password123")
    
    # Example usage for ifc_users
    # add_ifc_user("company_co@example.com", "password123", "company_co")
    
    # Example usage for companies
    # add_company(
    #     "COMP001",
    #     "Example Company",
    #     "company@example.com",
    #     "123 Main St, City, State",
    #     "123456789",
    #     "12ABCDE1234F1Z5",
    #     "ABCDE1234F",
    #     "5",
    #     "10"
    # )
    pass
