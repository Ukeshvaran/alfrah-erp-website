import psycopg2


def main():
    conn = psycopg2.connect(
        host="localhost",
        port=5432,
        dbname="alfrah_erp",
        user="postgres",
        password="database",
    )
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS monthly_salaries (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            team_member_id INTEGER NOT NULL REFERENCES team_members(id),
            cycle_start DATE,
            cycle_end DATE,
            cycle_revenue DOUBLE PRECISION DEFAULT 0,
            cycle_sales INTEGER DEFAULT 0,
            incentive_total DOUBLE PRECISION DEFAULT 0,
            incentive_added DOUBLE PRECISION DEFAULT 0,
            salary_earned DOUBLE PRECISION DEFAULT 0,
            salary_paid DOUBLE PRECISION DEFAULT 0,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cur.execute("ALTER TABLE IF EXISTS daily_performances DROP COLUMN IF EXISTS salary_paid")

    cur.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'monthly_salaries'"
    )
    columns = {row[0] for row in cur.fetchall()}
    if "month_start" in columns and "cycle_start" not in columns:
        cur.execute("ALTER TABLE monthly_salaries RENAME COLUMN month_start TO cycle_start")

    alter_statements = [
        "ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS cycle_start DATE",
        "ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS cycle_end DATE",
        "ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS cycle_revenue DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS cycle_sales INTEGER DEFAULT 0",
        "ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS incentive_total DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS incentive_added DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS salary_earned DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS salary_paid DOUBLE PRECISION DEFAULT 0",
    ]
    for statement in alter_statements:
        cur.execute(statement)

    cur.execute("ALTER TABLE monthly_salaries DROP CONSTRAINT IF EXISTS unique_member_month_salary")
    cur.execute("ALTER TABLE monthly_salaries DROP CONSTRAINT IF EXISTS unique_member_cycle_salary")
    cur.execute("UPDATE monthly_salaries SET cycle_start = CURRENT_DATE WHERE cycle_start IS NULL")
    cur.execute("UPDATE monthly_salaries SET cycle_end = cycle_start WHERE cycle_end IS NULL")
    cur.execute(
        "ALTER TABLE monthly_salaries ADD CONSTRAINT unique_member_cycle_salary UNIQUE (team_member_id, cycle_start)"
    )

    conn.commit()
    cur.close()
    conn.close()
    print("Database migration applied successfully.")


if __name__ == "__main__":
    main()
