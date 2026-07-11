import sqlite3

try:
    conn = sqlite3.connect('datalyze.db')
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cur.fetchall()
    
    print("\n--- Current Tables in datalyze.db ---")
    for table in tables:
        print(f"  • {table[0]}")
    print("-------------------------------------\n")
    
except Exception as e:
    print(f"Database error: {e}")
finally:
    if 'conn' in locals():
        conn.close()