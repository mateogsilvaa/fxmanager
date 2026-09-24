// Nombres ficticios por nacionalidad (para rookies y generación de parrillas)

export const NOMBRES = {
    es: {
        n: ['Álvaro', 'Hugo', 'Pablo', 'Marcos', 'Iker', 'Adrián', 'Javier', 'Sergio', 'Diego', 'Rubén', 'Nicolás', 'Daniel', 'Gonzalo', 'Mario', 'Óscar', 'Aitor', 'Unai', 'Martín', 'Lucas', 'Raúl', 'Íñigo', 'Bruno', 'Carlos', 'Jaime'],
        a: ['Vidal', 'Serrano', 'Ortega', 'Navarro', 'Castell', 'Ruiz', 'Montero', 'Llorente', 'Arrieta', 'Salcedo', 'Beltrán', 'Ferrer', 'Galán', 'Iturbe', 'Molina', 'Prieto', 'Roldán', 'Soler', 'Valls', 'Echeverría', 'Pons', 'Garrido', 'Quintana', 'Sanz', 'Aranda', 'Bravo'],
    },
    it: {
        n: ['Matteo', 'Lorenzo', 'Tommaso', 'Riccardo', 'Davide', 'Andrea', 'Federico', 'Gabriele', 'Leonardo', 'Alessio', 'Nicolò', 'Pietro', 'Filippo', 'Edoardo', 'Luca', 'Marco', 'Simone', 'Giacomo'],
        a: ['Ferraresi', 'Galli', 'Conti', 'Bellandi', 'Moretti', 'Rinaldi', 'Colombo', 'Marchetti', 'Pellegrini', 'Santoro', 'Fontana', 'Barbieri', 'Vitale', 'De Luca', 'Caruso', 'Mancini', 'Longo', 'Serra', 'Guidi', 'Lombardi'],
    },
    gb: {
        n: ['Oliver', 'Harry', 'Jack', 'George', 'Charlie', 'Thomas', 'James', 'William', 'Alfie', 'Callum', 'Ethan', 'Lewis', 'Rory', 'Finn', 'Owen', 'Joseph', 'Samuel', 'Daniel'],
        a: ['Whitmore', 'Ashford', 'Hale', 'Bennett', 'Crawley', 'Fairbairn', 'Holloway', 'Kendrick', 'Lister', 'Marsh', 'Pembroke', 'Rowe', 'Sinclair', 'Thornton', 'Walsh', 'Harker', 'Coleman', 'Doyle', 'Everett', 'Blackwood'],
    },
    de: {
        n: ['Lukas', 'Jonas', 'Leon', 'Felix', 'Maximilian', 'Paul', 'Niklas', 'Tim', 'Moritz', 'Julian', 'Jannik', 'Florian', 'Tobias', 'Fabian', 'Philipp', 'Erik', 'Kilian', 'Anton'],
        a: ['Brandt', 'Hartmann', 'Keller', 'Vogt', 'Lindner', 'Richter', 'Seidel', 'Krüger', 'Albrecht', 'Neumann', 'Engel', 'Baumann', 'Franke', 'Sommer', 'Winkler', 'Kaiser', 'Lorenz', 'Haas', 'Busch', 'Graf'],
    },
    au: {
        n: ['Jack', 'Cooper', 'Mitchell', 'Lachlan', 'Riley', 'Hayden', 'Brodie', 'Jordan', 'Nathan', 'Blake', 'Kai', 'Liam', 'Tyler', 'Declan', 'Zac', 'Harrison', 'Angus', 'Toby'],
        a: ['McAllister', 'Reid', 'Dawson', 'Fraser', 'Gallagher', 'Hughes', 'Kemp', 'Lawson', 'Moffat', 'Prescott', 'Quinlan', 'Rawlings', 'Stokes', 'Turnbull', 'Walker', 'Brennan', 'Carmody', 'Doherty', 'Ellis', 'Finch'],
    },
    fr: { n: ['Théo', 'Hugo', 'Louis', 'Arthur', 'Mathis', 'Enzo', 'Victor', 'Clément'], a: ['Laurent', 'Mercier', 'Dubois', 'Garnier', 'Rousseau', 'Faure', 'Chevalier', 'Lefèvre'] },
    pt: { n: ['Tiago', 'Rodrigo', 'Duarte', 'Afonso', 'Gonçalo'], a: ['Almeida', 'Carvalho', 'Figueiredo', 'Pereira', 'Teixeira'] },
    nl: { n: ['Daan', 'Sem', 'Thijs', 'Lars', 'Ruben'], a: ['de Vries', 'Bakker', 'Visser', 'Mulder', 'van Dijk'] },
    be: { n: ['Arne', 'Wout', 'Maxime', 'Jens'], a: ['Peeters', 'Claes', 'Wouters', 'Declercq'] },
    ch: { n: ['Noah', 'Luca', 'Gian', 'Nico'], a: ['Meier', 'Brunner', 'Frei', 'Zbinden'] },
    at: { n: ['Florian', 'Lukas', 'Elias'], a: ['Gruber', 'Huber', 'Pichler'] },
    se: { n: ['Oskar', 'Viktor', 'Axel', 'Linus'], a: ['Lindqvist', 'Berg', 'Ekström', 'Nyberg'] },
    no: { n: ['Magnus', 'Sander', 'Henrik'], a: ['Haugen', 'Solberg', 'Dahl'] },
    dk: { n: ['Mads', 'Frederik', 'Emil'], a: ['Holm', 'Nørgaard', 'Kjær'] },
    fi: { n: ['Aleksi', 'Eetu', 'Joonas'], a: ['Lehtonen', 'Virtanen', 'Salonen'] },
    pl: { n: ['Kacper', 'Jakub', 'Mateusz'], a: ['Nowak', 'Wiśniewski', 'Zieliński'] },
    ie: { n: ['Cian', 'Oisín', 'Conor'], a: ['Byrne', 'Kavanagh', 'Nolan'] },
    us: { n: ['Tyler', 'Mason', 'Logan', 'Carter', 'Austin'], a: ['Harper', 'Brooks', 'Sullivan', 'Hayes', 'Parker'] },
    ca: { n: ['Liam', 'Nolan', 'Dylan'], a: ['Tremblay', 'Gagnon', 'MacLeod'] },
    mx: { n: ['Santiago', 'Emiliano', 'Rodrigo'], a: ['Treviño', 'Villarreal', 'Cárdenas'] },
    ar: { n: ['Franco', 'Tomás', 'Valentino', 'Joaquín'], a: ['Ledesma', 'Bianchi', 'Acosta', 'Ferreyra'] },
    br: { n: ['Gabriel', 'Enzo', 'Rafael', 'Caio'], a: ['Moraes', 'Rezende', 'Barros', 'Figueira'] },
    cl: { n: ['Benjamín', 'Vicente'], a: ['Undurraga', 'Saavedra'] },
    co: { n: ['Sebastián', 'Samuel'], a: ['Restrepo', 'Ospina'] },
    uy: { n: ['Facundo', 'Agustín'], a: ['Olivera', 'Sosa'] },
    jp: { n: ['Haruto', 'Ren', 'Sota', 'Yuto'], a: ['Takahashi', 'Nakamura', 'Fujimoto', 'Ishikawa'] },
    nz: { n: ['Ryan', 'Hamish', 'Liam'], a: ['McKenzie', 'Tane', 'Gibson'] },
    za: { n: ['Kian', 'Ruan', 'Thabo'], a: ['van Wyk', 'Botha', 'Nkosi'] },
    cz: { n: ['Tomáš', 'Jan'], a: ['Dvořák', 'Novotný'] },
    hu: { n: ['Bence', 'Levente', 'Máté', 'Dániel'], a: ['Kovács', 'Szabó', 'Horváth', 'Varga'] },
    ee: { n: ['Karl', 'Rasmus', 'Oliver'], a: ['Tamm', 'Saar', 'Kask', 'Rebane'] },
    mc: { n: ['Louis', 'Stefano'], a: ['Grimaldi', 'Pastor'] },
};

// Distribución de nacionalidades extranjeras por liga (pesos)
export const EXTRANJEROS = {
    ESP: ['pt', 'ar', 'fr', 'mx', 'it', 'br', 'co', 'uy', 'cl', 'gb'],
    ITA: ['fr', 'ch', 'es', 'ar', 'br', 'at', 'mc', 'de', 'hu'],
    GBR: ['ie', 'us', 'ca', 'nz', 'se', 'nl', 'au', 'za', 'be'],
    GER: ['at', 'ch', 'nl', 'pl', 'dk', 'se', 'cz', 'fi', 'no', 'be'],
    AUS: ['nz', 'gb', 'jp', 'za', 'us', 'ie', 'ca', 'ee'],
};

export function nombreAleatorio(rng, nac, usados = new Set()) {
    const pool = NOMBRES[nac] && NOMBRES[nac].n.length ? NOMBRES[nac] : NOMBRES.gb;
    // primero se intenta no repetir ni nombre completo ni apellido
    for (let i = 0; i < 80; i++) {
        const n = rng.pick(pool.n), a = rng.pick(pool.a);
        const k = `${n} ${a}`;
        if (usados.has(k) || (i < 60 && usados.has(`@${a}`)) || (i < 30 && usados.has(`#${nac}${n}`))) continue;
        usados.add(k); usados.add(`@${a}`); usados.add(`#${nac}${n}`);
        return { nombre: n, apellido: a };
    }
    const n = rng.pick(pool.n), a = rng.pick(pool.a) + ' Jr.';
    usados.add(`${n} ${a}`);
    return { nombre: n, apellido: a };
}
