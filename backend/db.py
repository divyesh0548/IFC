import psycopg2

# Database connection parameters
DB_NAME = "ifc_dev"
DB_USER = "divyesh"  # Change if your PostgreSQL user is different
DB_PASSWORD = "0548"  # Add your PostgreSQL password if required
DB_HOST = "localhost"
DB_PORT = "5432"

def get_connection():
    """Creates and returns a database connection"""
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

if __name__ == "__main__":
    # Create ifc_users table
    create_ifc_users_table()
    
    # Add temp_login column to ifc_users table
    # add_temp_login_column()
    
    # Example usage for siteadmin
    # add_siteadmin("siteadmin@gmail.com", "password123")
    
    # Example usage for ifc_users
    add_ifc_user("company_co@example.com", "password123", "company_co")

