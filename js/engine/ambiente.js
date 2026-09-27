// Noticias de ambiente: una al día por liga, a partir de datos reales de la temporada.
// Así todas las ligas tienen actividad parecida y la prensa no se llena siempre de lo mismo.

// ctx: { liga, nombreLiga, tabla (construirTemporada), nombre(pid), apellido(pid), equipo(eqId), companero(pid),
//        prox: {circuito, ronda} | null, recientes: Set de claves usadas hace poco }
export function noticiaAmbiente(rng, c) {
    const P = c.tabla.clasPilotos || [], E = c.tabla.clasEquipos || [];
    const hay = P.some(p => p.pts > 0);
    const gen = [];
    const add = (clave, peso, f) => { if (!c.recientes.has(clave)) gen.push([clave, peso, f]); };

    // Previa del próximo circuito
    if (c.prox?.circuito) {
        const ci = c.prox.circuito;
        add(`circuito_${ci.id || ci.nombre}`, 3, () => {
            const rasgo = ci.adelantar < 0.3 ? ['adelantar es casi imposible', 'la clasificación decidirá media carrera']
                : ci.adelantar > 0.55 ? ['se adelanta mucho', 'nadie tiene la carrera ganada desde la pole']
                    : ci.desgaste > 0.6 ? ['los neumáticos sufren muchísimo', 'el blando puede ser una trampa']
                        : ci.lluvia > 0.25 ? ['la lluvia aparece a menudo', 'habrá que mirar el cielo hasta el último minuto']
                            : ci.motor > 0.45 ? ['manda la potencia', 'los coches con buen motor parten con ventaja']
                                : ['todo tiene que estar en su sitio', 'un reglaje fino marcará la diferencia'];
            return { titulo: `${ci.nombre}: donde ${rasgo[0]}`, texto: `La jornada ${c.prox.ronda} de ${c.nombreLiga} llega a ${ci.nombre}, un trazado de ${String(ci.km).replace('.', ',')} km en el que ${rasgo[1]}.`, tipo: 'previa' };
        });
    }
    if (hay) {
        const lider = P[0], segundo = P[1];
        // Pelea por el liderato
        if (segundo) add(`liderato_${lider.pid}`, 3, () => {
            const dif = lider.pts - segundo.pts;
            return dif <= 15
                ? { titulo: `Solo ${dif} puntos separan a ${c.apellido(lider.pid)} y ${c.apellido(segundo.pid)}`, texto: `El liderato de ${c.nombreLiga} está al rojo vivo: ${c.nombre(lider.pid)} (${lider.pts}) contra ${c.nombre(segundo.pid)} (${segundo.pts}).`, tipo: 'noticia' }
                : { titulo: `${c.apellido(lider.pid)} se escapa en ${c.nombreLiga}`, texto: `${c.nombre(lider.pid)} ya saca ${dif} puntos a ${c.nombre(segundo.pid)}. ¿Alguien puede pararle?`, tipo: 'noticia' };
        });
        // Duelo entre compañeros más igualado
        const duelos = E.map(e => P.filter(p => p.eq === e.eq)).filter(x => x.length === 2).map(([a, b]) => ({ a, b, dif: Math.abs(a.pts - b.pts) })).filter(x => x.a.pts + x.b.pts > 20).sort((x, y) => x.dif - y.dif);
        if (duelos[0]) add(`duelo_${duelos[0].a.eq}`, 2, () => {
            const { a, b, dif } = duelos[0];
            return { titulo: `Guerra interna en ${c.equipo(a.eq)}`, texto: `${c.nombre(a.pid)} y ${c.nombre(b.pid)} están separados por ${dif} punto${dif === 1 ? '' : 's'}. En el box nadie quiere ser el segundo piloto.`, tipo: 'rumor' };
        });
        // Mayor diferencia entre compañeros
        const desigual = duelos.slice().sort((x, y) => y.dif - x.dif)[0];
        if (desigual && desigual.dif > 40) add(`desigual_${desigual.a.eq}`, 2, () => {
            const [fuerte, flojo] = desigual.a.pts > desigual.b.pts ? [desigual.a, desigual.b] : [desigual.b, desigual.a];
            return { titulo: `${c.apellido(flojo.pid)}, bajo la lupa`, texto: `Con el mismo coche, ${c.nombre(fuerte.pid)} le saca ${desigual.dif} puntos. En ${c.equipo(flojo.eq)} empiezan a hacerse preguntas.`, tipo: 'rumor' };
        });
        // Hitos de puntos
        const hito = P.find(p => [100, 150, 200, 250, 300].some(h => p.pts >= h && p.pts < h + 25));
        if (hito) add(`hito_${hito.pid}_${Math.floor(hito.pts / 50)}`, 2, () => ({ titulo: `${c.apellido(hito.pid)} supera los ${Math.floor(hito.pts / 50) * 50} puntos`, texto: `${c.nombre(hito.pid)} (${c.equipo(hito.eq)}) suma ya ${hito.pts} puntos esta temporada.`, tipo: 'noticia' }));
        // El más adelantador / remontador
        const adel = P.slice().sort((a, b) => (b.adel || 0) - (a.adel || 0))[0];
        if (adel?.adel > 5) add(`adel_${adel.pid}`, 1, () => ({ titulo: `${c.apellido(adel.pid)}, el rey de los adelantamientos`, texto: `Nadie en ${c.nombreLiga} ha adelantado tanto como ${c.nombre(adel.pid)}: ${adel.adel} maniobras esta temporada.`, tipo: 'noticia' }));
        // Abandonos
        const dnf = P.slice().sort((a, b) => (b.dnf || 0) - (a.dnf || 0))[0];
        if (dnf?.dnf >= 2) add(`dnf_${dnf.pid}_${dnf.dnf}`, 2, () => ({ titulo: `La mala suerte persigue a ${c.apellido(dnf.pid)}`, texto: `${c.nombre(dnf.pid)} acumula ${dnf.dnf} abandonos. En ${c.equipo(dnf.eq)} piden revisar la fiabilidad del coche.`, tipo: 'rumor' }));
        // Sin puntos todavía
        const ceros = P.filter(p => (p.carreras || 0) >= 3 && p.pts === 0);
        if (ceros.length) add(`cero_${ceros[0].pid}`, 1, () => ({ titulo: `${c.apellido(ceros[0].pid)} sigue sin estrenarse`, texto: `Tras ${ceros[0].carreras} carreras, ${c.nombre(ceros[0].pid)} (${c.equipo(ceros[0].eq)}) todavía no ha sumado ni un punto.`, tipo: 'noticia' }));
        // Mercado: otra liga se fija en un piloto del top 5
        const top = P.slice(0, 5);
        if (top.length) add(`interes_${c.liga}`, 2, () => {
            const p = rng.pick(top);
            return { titulo: `El Mundial se fija en ${c.apellido(p.pid)}`, texto: `Varias escuderías de otras ligas siguen de cerca a ${c.nombre(p.pid)} (${p.posicion}º en ${c.nombreLiga}) de cara al mercado de Galácticos.`, tipo: 'mercado' };
        });
        // Escudería en crisis
        const ultima = E[E.length - 1];
        if (ultima && E.length > 3) add(`crisis_${ultima.eq}`, 1, () => ({ titulo: `${c.equipo(ultima.eq)} toca fondo`, texto: `Últimos de ${c.nombreLiga} con ${ultima.pts} puntos. La fábrica trabaja a destajo para cambiar la dinámica.`, tipo: 'rumor' }));
    } else {
        add(`arranque_${c.liga}`, 2, () => ({ titulo: `Cuenta atrás en ${c.nombreLiga}`, texto: 'Las escuderías apuran los últimos días de pretemporada: simulador, reglajes y ni un minuto que perder.', tipo: 'noticia' }));
    }
    if (!gen.length) return null;
    const total = gen.reduce((s, g) => s + g[1], 0);
    let x = rng.next() * total;
    for (const [clave, peso, f] of gen) { x -= peso; if (x <= 0) return { clave, ...f() }; }
    const [clave, , f] = gen[0];
    return { clave, ...f() };
}

// Rumores de mejoras: textos variados
export function rumorMejora(rng, equipo, area) {
    return rng.pick([
        { titulo: `${equipo} estrena evolución`, texto: `Se rumorea en el paddock que ${equipo} ha dado un paso adelante en ${area}.` },
        { titulo: `Piezas nuevas en el camión de ${equipo}`, texto: `Los mecánicos de ${equipo} han descargado material nuevo. Todo apunta a una mejora de ${area}.` },
        { titulo: `${equipo} presume de datos en el simulador`, texto: `Fuentes de la fábrica aseguran que la nueva ${area} de ${equipo} rinde por encima de lo esperado.` },
        { titulo: `¿Paso adelante de ${equipo}?`, texto: `Los rivales sospechan que ${equipo} ha mejorado su ${area}. Habrá que verlo en pista.` },
    ]);
}
