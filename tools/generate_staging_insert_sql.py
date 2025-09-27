#!/usr/bin/env python3
import sys, csv

def esc(s: str) -> str:
    return s.replace("'", "''")

def main():
    if len(sys.argv) < 3:
        print('Uso: generate_staging_insert_sql.py <input.csv> <output.sql>')
        sys.exit(1)
    inp, out = sys.argv[1], sys.argv[2]

    with open(inp, 'r', newline='', encoding='utf-8') as f_in:
        reader = csv.DictReader(f_in)
        values = []
        for row in reader:
            nome = (row.get('nome') or '').strip()
            whatsapp = (row.get('whatsapp') or '').strip()
            status = (row.get('status') or '').strip()
            color = (row.get('color_card') or '').strip()
            if not nome:
                continue
            v = "('" + esc(nome) + "', '" + esc(whatsapp) + "', '" + esc(status) + "', "
            v += ("NULL" if color == '' else "'" + esc(color) + "'")
            v += ")"
            values.append(v)

    if not values:
        print('Nenhuma linha válida encontrada no CSV.')
        sys.exit(1)

    sql = "INSERT INTO staging_recrutadora (nome, whatsapp, status, color_card) VALUES\n" + ",\n".join(values) + ";\n"
    with open(out, 'w', encoding='utf-8') as f_out:
        f_out.write(sql)
    print(f'Gerado: {out} com {len(values)} linhas')

if __name__ == '__main__':
    main()
