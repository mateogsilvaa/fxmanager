// Palabras prohibidas en los nombres de escudería (español e inglés).
// Para añadir una, escríbela en minúsculas y sin tildes en la lista que toque.

// Se buscan como palabra suelta (así "computadora" no salta por "puta")
export const PALABRAS = [
    // español
    'puta', 'puto', 'putas', 'putos', 'puton', 'putita', 'zorra', 'zorras', 'guarra', 'furcia', 'ramera', 'golfa',
    'polla', 'pollas', 'pene', 'coño', 'chocho', 'verga', 'pija', 'cipote', 'tetas', 'teta', 'culo', 'culos', 'ojete', 'ano', 'mierda', 'mierdas', 'cagar', 'cago', 'caca', 'meado', 'mear',
    'follar', 'follando', 'follador', 'folla', 'joder', 'jodete', 'jodido', 'jodida', 'chingar', 'chingada', 'pendejo',
    'pendeja', 'cabron', 'cabrona', 'cabrones', 'gilipollas', 'gilipolla', 'capullo', 'imbecil', 'idiota', 'subnormal',
    'retrasado', 'retrasada', 'mongolo', 'mongola', 'estupido', 'estupida', 'soplapollas', 'mamon',
    'mamona', 'mamada', 'pajero', 'pajillero', 'corrida', 'correrse', 'orgasmo', 'porno', 'porn', 'xxx', 'sexo',
    'maricon', 'marica', 'mariquita', 'bollera', 'tortillera', 'travelo', 'sarasa', 'negrata', 'sudaca', 'panchito',
    'nazi', 'nazis', 'facha', 'fachas', 'hitler', 'franquista', 'kkk', 'violador', 'violacion', 'pederasta', 'pedofilo', 'zoofilia', 'hostia', 'hostias', 'cocaina', 'heroina', 'porro', 'porros', 'hachis', 'etarra', 'yihad', // inglés
    'fuck', 'fucker', 'fucking', 'fucked', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'cunt',
    'dick', 'dicks', 'cock', 'cocks', 'pussy', 'penis', 'vagina', 'boobs', 'tits', 'ass', 'asshole', 'arse', 'arsehole',
    'bastard', 'slut', 'whore', 'wanker', 'wank', 'cum', 'sex', 'sexy', 'nude', 'nudes', 'anal', 'dildo',
    'fag', 'faggot', 'dyke', 'tranny', 'nigger', 'nigga', 'retard', 'retarded', 'spic', 'chink', 'kike',
    'rape', 'rapist', 'pedo', 'pedophile', 'heil', 'jihad', 'terrorist', 'cocaine', 'weed', 'meth',
];

// Se buscan en cualquier parte del texto (ya sin espacios ni signos): solo las inequívocas
export const FRAGMENTOS = [
    'hijodeputa', 'hijoputa', 'hdp', 'mecagoen', 'mecagu', 'putamadre', 'tuputa', 'gilipoll', 'soplapoll', 'chupapoll',
    'comepoll', 'follamadres', 'motherfuck', 'fuck', 'shit', 'nigger', 'nigga', 'faggot', 'hitler', 'nazi', 'siegheil',
    'heilhit', 'kukluxklan', 'pedofil', 'pederast', 'violador', 'maricon', 'bollera', 'negrata', 'sudaca', 'retrasad',
    'subnormal', 'asshole', 'bitch', 'cunt', 'whore', 'porno', 'pornhub', 'xvideos', 'onlyfans', 'pollon', 'pollaz',
];

const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '€': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };

function normalizar(texto) {
    return String(texto || '').toLowerCase().replace(/ñ/g, '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[0-9!|€@$+]/g, (c) => LEET[c] || c).replace(//g, 'ñ');
}

const SET_PALABRAS = new Set(PALABRAS.map(normalizar));
const FRAG = FRAGMENTOS.map(normalizar);

// Devuelve la palabra problemática o null si el texto es aceptable
export function palabraProhibida(texto) {
    const n = normalizar(texto);
    const palabras = n.split(/[^a-zñ]+/).filter(Boolean);
    for (const p of palabras) {
        if (SET_PALABRAS.has(p)) return p;
        // letras repetidas para esquivar el filtro: "puuuta"
        const sinRep = p.replace(/(.)\1+/g, '$1');
        if (SET_PALABRAS.has(sinRep)) return p;
    }
    const junto = n.replace(/[^a-zñ]+/g, '');
    const juntoSinRep = junto.replace(/(.)\1+/g, '$1');
    for (const f of FRAG) if (junto.includes(f) || juntoSinRep.includes(f)) return f;
    // palabras sueltas separadas por espacios o puntos: "p u t a"
    const letras = palabras.filter(p => p.length === 1).join('');
    if (letras.length >= 3) for (const p of SET_PALABRAS) if (p.length >= 3 && letras.includes(p)) return p;
    return null;
}

// Valida un nombre de escudería. Devuelve un mensaje de error o null si vale.
export function validarNombreEscuderia(nombre, { min = 3, max = 32 } = {}) {
    const t = String(nombre || '').trim().replace(/\s+/g, ' ');
    if (t.length < min) return `El nombre tiene que tener al menos ${min} caracteres.`;
    if (t.length > max) return `El nombre no puede pasar de ${max} caracteres.`;
    if (!/^[\p{L}\p{N} .'&-]+$/u.test(t)) return 'Solo letras, números, espacios y los signos . \' & -';
    if (!/\p{L}.*\p{L}/u.test(t)) return 'El nombre tiene que llevar letras.';
    if (palabraProhibida(t)) return 'Ese nombre no está permitido.';
    return null;
}
