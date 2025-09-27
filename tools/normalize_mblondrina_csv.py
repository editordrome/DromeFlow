#!/usr/bin/env python3
import sys, csv, re

MAPPING = {
    'DESISTENTES': 'desistentes',
    'FINALIZADOS': 'finalizado',
    'NÃO APROVADAS': 'nao_aprovadas',
    'NAO APROVADAS': 'nao_aprovadas',
    'TRUORA': 'truora',
    'ENVIO DE DOCUMENTOS': 'envio_doc',
}

def normalize_status(s: str) -> str:
    if not s:
        return 'contato'
    s = s.strip().upper()
    return MAPPING.get(s, 'contato')

def clean_phone(p: str) -> str:
    if not p:
        return ''
    return re.sub(r'\D+', '', p)

def main():
    if len(sys.argv) < 3:
        print('Uso: normalize_mblondrina_csv.py <input.csv> <output.csv>')
        sys.exit(1)
    inp, out = sys.argv[1], sys.argv[2]

    with open(inp, 'r', newline='', encoding='utf-8') as f_in:
        reader = csv.DictReader(f_in)
        fieldnames = ['nome', 'whatsapp', 'status', 'color_card']
        with open(out, 'w', newline='', encoding='utf-8') as f_out:
            writer = csv.DictWriter(f_out, fieldnames=fieldnames)
            writer.writeheader()
            for row in reader:
                nome = (row.get('nome') or '').strip()
                if not nome:
                    continue
                whatsapp = clean_phone(row.get('whatsapp') or '')
                status_src = row.get('STATUS') or row.get('status') or ''
                status = normalize_status(status_src)
                color = (row.get('color_card') or '').strip() or ''
                writer.writerow({'nome': nome, 'whatsapp': whatsapp, 'status': status, 'color_card': color})

if __name__ == '__main__':
    main()
