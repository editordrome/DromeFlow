#!/usr/bin/env python3
import sys, csv

COLS = [
  'id','created_at','nome','data_nasc','whatsapp','dias_livres','dias_semana','fumante','rest_pet','rest_pet_qual',
  'exp_residencial','ref_residencial','exp_comercial','ref_comercial','sit_atual','motivo_cadastro','estado_civil',
  'filhos','qto_filhos','rotina_filhos','transporte','STATUS','endereço','rg','cpf','color_card','observacao','unidade'
]

def esc(v: str) -> str:
    return v.replace("'", "''")

def val(v: str):
    if v is None: return 'NULL'
    v = v.strip()
    if v == '': return 'NULL'
    return "'" + esc(v) + "'"

def main():
    if len(sys.argv) < 3:
        print('Uso: generate_staging_raw_insert_sql.py <input.csv> <output.sql>')
        sys.exit(1)
    inp, out = sys.argv[1], sys.argv[2]

    with open(inp, 'r', newline='', encoding='utf-8') as f_in:
        reader = csv.DictReader(f_in)
        values = []
        for row in reader:
            arr = [val(row.get(c)) for c in COLS]
            values.append('(' + ', '.join(arr) + ')')

    if not values:
        print('Nenhuma linha encontrada no CSV.')
        sys.exit(1)

    cols_sql = ', '.join([
        'id','created_at','nome','data_nasc','whatsapp','dias_livres','dias_semana','fumante','rest_pet','rest_pet_qual',
        'exp_residencial','ref_residencial','exp_comercial','ref_comercial','sit_atual','motivo_cadastro','estado_civil',
        'filhos','qto_filhos','rotina_filhos','transporte','"STATUS"','"endereço"','rg','cpf','color_card','observacao','unidade'
    ])
    sql = f"INSERT INTO staging_mblondrina_raw ({cols_sql}) VALUES\n" + ",\n".join(values) + ";\n"
    with open(out, 'w', encoding='utf-8') as f_out:
        f_out.write(sql)
    print(f'Gerado: {out} com {len(values)} linhas')

if __name__ == '__main__':
    main()
