"""Initialize database"""
import os
import re

import pandas as pd
from sqlalchemy.engine import Connection
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.sql import text

from backend.db.config import DATASETS_PATH, CONFIG
from backend.db.utils import database_exists, run_sql, get_db_connection


DB = CONFIG["DB"]


def initialize():
    """Initialize set up of DB

    Resources
    - https://docs.sqlalchemy.org/en/20/core/engines.html
    - https://docs.sqlalchemy.org/en/20/dialects/mysql.html

    todo: (can do in ddl.sql): don't do anything if these tables exist & initialized
    """
    tables_to_load = [
        'code_sets',
        'concept',
        'concept_ancestor',
        'concept_relationship',
        'concept_relationship_subsumes_only',
        'concept_set_container',
        'concept_set_counts_clamped',
        'concept_set_members',
        'concept_set_version_item',
        'deidentified_term_usage_by_domain_clamped',
    ]
    # TODO: alter these columns as indicated:
    datetime_cols = [
        ('code_sets', 'created_at'),
        ()]
    date_cols = [
        ('concept', 'valid_end_date'),
        ('concept', 'valid_start_date'),
        ('concept_relationship', 'valid_end_date'),
        ('concept_relationship', 'valid_start_date')]

    with get_db_connection(new_db=True) as con:
        # postgres doesn't have create database if not exists
        if CONFIG["server"] != 'postgresql':
            run_sql(con, 'CREATE DATABASE IF NOT EXISTS ' + DB)
            run_sql(con, f'USE {DB}')
        else:
            # @Siggie: set_isolation_level fixed this problem I had. When you see this, you can remove this comment.
            # https://stackoverflow.com/questions/5402805/error-when-creating-a-postgresql-database-using-python-sqlalchemy-and-psycopg2
            if not database_exists(con, DB):
                con.connection.connection.set_isolation_level(0)
                run_sql(con, 'CREATE DATABASE ' + DB)
                con.connection.connection.set_isolation_level(1)

        for table in tables_to_load:
            print(f'loading {table} into {CONFIG["server"]}:{DB}')
            load_csv(con, table)

        # with open(DDL_PATH, 'r') as file:
        #     contents: str = file.read()
        # commands: List[str] = [x + ';' for x in contents.split(';\n')]
        # for command in commands:
        # Insert data
        # except (ProgrammingError, OperationalError):
        #     raise RuntimeError(f'Got an error executing the following statement:\n{command}')

    return


def load_csv(con: Connection, table: str, replace_if_exists=True):
    """Load CSV into table

    - Uses: https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_sql.html
    """
    df = pd.read_csv(os.path.join(DATASETS_PATH, f'{table}.csv'))
    if not replace_if_exists:
        # TODO: make this work:
        # query:  show tables where Tables_in_termhub_n3c = {table}
        # if query not returns empty:
        #   return
        pass
    try:
        con.execute(text(f'TRUNCATE {table}'))
    except ProgrammingError:
        pass
    # `schema='termhub_n3c'`: Passed so Joe doesn't get OperationalError('(pymysql.err.OperationalError) (1050,
    #  "Table \'code_sets\' already exists")')
    #  https://stackoverflow.com/questions/69906698/pandas-to-sql-gives-table-already-exists-error-with-if-exists-append
    try:
        kwargs = {'if_exists': 'append', 'index': False}
        if CONFIG['server'] == 'mysql':
            kwargs['schema'] = DB
        df.to_sql(table, con, **kwargs)
    except Exception as err:
        # if data too long error, change column to longtext and try again
        # noinspection PyUnresolvedReferences
        m = re.match("Data too long for column '(.*)'.*", str(err.orig.args))
        if m:
            run_sql(con, f'ALTER TABLE {table} MODIFY {m[1]} LONGTEXT')
            load_csv(con, table)
        else:
            raise err


if __name__ == '__main__':
    initialize()