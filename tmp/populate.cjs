
const fs = require('fs');
const path = require('path');

const guiaPath = path.join(__dirname, '../Guia.md');
const content = fs.readFileSync(guiaPath, 'utf8');

const mapping = {
    'Módulo 0': 'dd8873ff-70be-424a-bc2d-00258d0d54b0',
    'Módulo 1.1': 'ce1756be-b328-409f-97e1-d97a542752c8',
    'Módulo 1.2': 'ce1756be-b328-409f-97e1-d97a542752c8',
    'Módulo 1.3': 'ce1756be-b328-409f-97e1-d97a542752c8',
    'Módulo 1.4': 'ce1756be-b328-409f-97e1-d97a542752c8',
    'Módulo 2.1': '0ed70987-19ae-425b-bf5e-5b0cc0cf216f',
    'Módulo 2.2': '0ed70987-19ae-425b-bf5e-5b0cc0cf216f',
    'Módulo 2.3': '0ed70987-19ae-425b-bf5e-5b0cc0cf216f',
    'Módulo 2.4': '0ed70987-19ae-425b-bf5e-5b0cc0cf216f',
    'Módulo 3': '581baf9c-429d-4ad9-abce-f064ea222d6f',
    'Módulo 3.1': '581baf9c-429d-4ad9-abce-f064ea222d6f',
    'Módulo 4': '522ee727-1229-4fea-a588-9ce74b81782c',
    'Módulo 5': '6a07f956-44c7-443a-a440-8e95611eeb53',
    'Módulo 6': '1c6c781c-cd56-44f7-8c24-7126fc6ec9a3',
    'Módulo 6.1': '1c6c781c-cd56-44f7-8c24-7126fc6ec9a3',
    'Módulo 6.2': '1c6c781c-cd56-44f7-8c24-7126fc6ec9a3'
};

const regex = /(🔐|🏢|💸|👥|📄|📊|📅|🔍|📈|🤝)\s+(Módulo\s+[0-9.]+):?\s+([^\n]+)([\s\S]+?)(?=\s+(🔐|🏢|💸|👥|📄|📊|📅|🔍|📈|🤝)\s+Módulo\s+[0-9.]+:|$)/g;

let match;
const sqlUpdates = [];

while ((match = regex.exec(content)) !== null) {
    const icon = match[1];
    const moduleKey = match[2].trim();
    const title = match[3].trim();
    let body = match[4].trim();
    
    // Clean up body title overlaps
    if (body.startsWith(title)) {
        body = body.substring(title.length).trim();
    }

    const moduleId = mapping[moduleKey] || mapping[moduleKey.split(' ')[0] + ' ' + moduleKey.split(' ')[1]];
    
    if (moduleId) {
        // Prepare SQL insert
        const escapedTitle = title.replace(/'/g, "''");
        const escapedContent = body.replace(/'/g, "''");
        
        sqlUpdates.push(`INSERT INTO system_manuals (module_id, title, content, position, updated_at) 
        VALUES ('${moduleId}', '${escapedTitle}', '${escapedContent}', 0, NOW())
        ON CONFLICT (module_id, title) DO UPDATE SET 
            content = EXCLUDED.content,
            updated_at = NOW();`);
    }
}

fs.writeFileSync(path.join(__dirname, 'populate.sql'), sqlUpdates.join('\n'));
console.log(`Generated ${sqlUpdates.length} SQL statements in tmp/populate.sql`);
