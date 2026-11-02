'use strict';

/* Libertadores — escaramuza estática (sin CDN ni build).
   ?victoria=1  fusileros destruyen el campamento realista.
   ?auto=1      los patriotas juegan solos, a mayor velocidad.
   window.__LIBERTAD expone el estado para pruebas. */

const MUNDO = { w: 2200, h: 1400 };
const ZOOM_MAX = 1.75;
const TOPE_POBLACION = 40;
const TOPE_MAXIMO = 75;
const TOPE_POR_CASA = 5;
const TIEMPO_OBRA = 14;
const MARGEN_BORDE_TACTIL = 28;
const MARGEN_BORDE_RATON = 24;

const CAMP = {
  patriota: { x: 400, y: 1040 },
  realista: { x: 1800, y: 320 },
};

const EDIF = {
  centro: { hp: 1800, ancho: 116, alto: 104 },
  cuartel: { hp: 980, ancho: 132, alto: 86 },
  casa: { hp: 360, ancho: 64, alto: 56 },
};

const STAT = {
  aldeano: { hp: 40, velocidad: 96, dano: 2, alcance: 14, cadencia: 1.05, radio: 11, poblacion: 1, aggro: 0, carga: 12 },
  fusilero: { hp: 74, velocidad: 72, dano: 11, alcance: 136, cadencia: 0.95, radio: 12, poblacion: 1, aggro: 200 },
  lancero: { hp: 96, velocidad: 142, dano: 16, alcance: 24, cadencia: 0.75, radio: 15, poblacion: 1, aggro: 140 },
  fusilero_realista: { hp: 82, velocidad: 68, dano: 10, alcance: 128, cadencia: 0.95, radio: 12, poblacion: 1, aggro: 190 },
  dragon: { hp: 110, velocidad: 126, dano: 16, alcance: 24, cadencia: 0.8, radio: 15, poblacion: 2, aggro: 150 },
};

const COSTO = {
  aldeano: { comida: 60, madera: 0, oro: 0, tiempo: 8, poblacion: 1 },
  cuartel: { comida: 0, madera: 120, oro: 0, tiempo: TIEMPO_OBRA },
  casa: { comida: 0, madera: 70, oro: 0, tiempo: 10 },
  fusilero: { comida: 34, madera: 30, oro: 40, tiempo: 8, poblacion: 1 },
  lancero: { comida: 26, madera: 40, oro: 62, tiempo: 11, poblacion: 1 },
  fusilero_realista: { comida: 32, madera: 8, oro: 14, tiempo: 8, poblacion: 1 },
  dragon: { comida: 26, madera: 12, oro: 22, tiempo: 10, poblacion: 2 },
};

const NODOS = [
  ['comida', 'arbusto', 280, 940, 340, 26],
  ['comida', 'arbusto', 560, 910, 340, 26],
  ['comida', 'arbusto', 250, 1080, 280, 24],
  ['comida', 'huerta', 640, 1140, 460, 34],
  ['madera', 'bosque', 800, 960, 980, 48],
  ['oro', 'mina', 900, 1080, 720, 30],
  ['oro', 'mina', 1080, 920, 1100, 36],
  ['comida', 'arbusto', 1660, 230, 340, 26],
  ['comida', 'huerta', 1980, 340, 460, 34],
  ['comida', 'arbusto', 1560, 420, 280, 24],
  ['madera', 'bosque', 2060, 200, 980, 46],
  ['madera', 'bosque', 1460, 240, 760, 42],
  ['oro', 'mina', 1320, 480, 720, 30],
  ['oro', 'mina', 1140, 700, 860, 34],
  ['madera', 'bosque', 980, 560, 860, 44],
  ['comida', 'arbusto', 1280, 860, 320, 26],
  ['comida', 'huerta', 900, 740, 400, 32],
];

const SITIOS_REALISTAS = [
  { x: 1680, y: 560 },
  { x: 1500, y: 600 },
  { x: 1860, y: 520 },
  { x: 1600, y: 700 },
];

const SITIOS_PATRIOTAS = [
  { x: 230, y: 880 },
  { x: 520, y: 1220 },
  { x: 300, y: 1200 },
  { x: 640, y: 860 },
];

const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d', { alpha: false });
const minimapa = document.getElementById('minimapa');
const mctx = minimapa.getContext('2d', { alpha: false });
const elComida = document.getElementById('val-comida');
const elMadera = document.getElementById('val-madera');
const elOro = document.getElementById('val-oro');
const elPoblacion = document.getElementById('val-poblacion');
const elTiempo = document.getElementById('val-tiempo');
const elPista = document.getElementById('pista-texto');
const elComandos = document.getElementById('comandos');
const elFichaNombre = document.getElementById('ficha-nombre');
const elFichaDetalle = document.getElementById('ficha-detalle');
const elAviso = document.getElementById('aviso');
const elFin = document.getElementById('fin');
const elFinTitulo = document.getElementById('fin-titulo');
const elFinTexto = document.getElementById('fin-texto');

const sprites = {};
const punteros = new Map();
const teclas = new Set();
const cache = { comida: -1, madera: -1, oro: -1, pob: '', reloj: '', firma: '', pista: '' };
let usaTacto = false;
const vista = { w: 800, h: 400, dpr: 1 };
const mini = { w: 132, h: 84 };
const cam = { x: 480, y: 990, zoom: 1.05 };

let terreno = null;
let partida = null;
let gesto = null;
let mouse = null;
let punteroMundo = { x: 600, y: 1000 };
let avisoTimer = 0;
let ultimo = 0;
let iniciado = false;

function rng(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function uid() {
  return partida.seq++;
}

function oponente(equipo) {
  return equipo === 'patriota' ? 'realista' : 'patriota';
}

function porId(id) {
  if (id == null) return null;
  for (const u of partida.unidades) if (u.id === id) return u;
  for (const b of partida.edificios) if (b.id === id) return b;
  for (const n of partida.nodos) if (n.id === id) return n;
  return null;
}

function mundoAPantalla(x, y) {
  return {
    x: (x - cam.x) * cam.zoom + vista.w / 2,
    y: (y - cam.y) * cam.zoom + vista.h / 2,
  };
}

function pantallaAMundo(x, y) {
  return {
    x: (x - vista.w / 2) / cam.zoom + cam.x,
    y: (y - vista.h / 2) / cam.zoom + cam.y,
  };
}

function zoomMinimo() {
  if (!vista.w || !vista.h) return 0.7;
  const cubre = Math.max((vista.w + 2) / MUNDO.w, (vista.h + 2) / MUNDO.h);
  return Math.min(ZOOM_MAX, cubre);
}

function clampCamara() {
  const minimo = zoomMinimo();
  if (cam.zoom < minimo) cam.zoom = minimo;
  if (cam.zoom > ZOOM_MAX) cam.zoom = ZOOM_MAX;
  const mitadW = vista.w / (2 * cam.zoom);
  const mitadH = vista.h / (2 * cam.zoom);
  if (mitadW * 2 >= MUNDO.w - 1) cam.x = MUNDO.w / 2;
  else cam.x = clamp(cam.x, mitadW, MUNDO.w - mitadW);
  if (mitadH * 2 >= MUNDO.h - 1) cam.y = MUNDO.h / 2;
  else cam.y = clamp(cam.y, mitadH, MUNDO.h - mitadH);
}

function enfoque(x, y, zoom) {
  cam.x = x;
  cam.y = y;
  if (zoom) cam.zoom = zoom;
  clampCamara();
}

function distanciaAlBorde(u, objetivo) {
  if (objetivo.ancho) {
    const dx = Math.abs(u.x - objetivo.x) - objetivo.ancho / 2;
    const dy = Math.abs(u.y - objetivo.y) - objetivo.alto / 2;
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  }
  return Math.max(0, Math.hypot(u.x - objetivo.x, u.y - objetivo.y) - (objetivo.radio || 0));
}

function circuloTocaRect(cx, cy, r, rect) {
  const dx = Math.abs(cx - rect.x);
  const dy = Math.abs(cy - rect.y);
  if (dx > rect.ancho / 2 + r) return false;
  if (dy > rect.alto / 2 + r) return false;
  if (dx <= rect.ancho / 2 || dy <= rect.alto / 2) return true;
  const ex = dx - rect.ancho / 2;
  const ey = dy - rect.alto / 2;
  return ex * ex + ey * ey <= r * r;
}

function enVista(x, y, margen) {
  const hw = vista.w / (2 * cam.zoom) + margen;
  const hh = vista.h / (2 * cam.zoom) + margen;
  return Math.abs(x - cam.x) < hw && Math.abs(y - cam.y) < hh;
}

function crearUnidad(tipo, equipo, x, y) {
  const s = STAT[tipo];
  const u = {
    id: uid(),
    clase: 'unidad',
    esUnidad: true,
    tipo,
    equipo,
    x,
    y,
    frente: equipo === 'patriota' ? 1 : -1,
    hp: s.hp,
    hpMax: s.hp,
    velocidad: s.velocidad,
    dano: s.dano,
    alcance: s.alcance,
    cadencia: s.cadencia,
    radio: s.radio,
    poblacion: s.poblacion,
    aggro: s.aggro,
    cargaMax: s.carga || 0,
    carga: 0,
    cargaTipo: null,
    estado: 'quieto',
    destino: null,
    objetivoId: null,
    asaltoId: null,
    nodoId: null,
    temporizador: 0,
    recarga: 0.2,
    golpe: 0,
    polvo: 0,
    muerto: false,
  };
  partida.unidades.push(u);
  return u;
}

function crearEdificio(tipo, equipo, x, y, completo) {
  const s = EDIF[tipo];
  const b = {
    id: uid(),
    clase: 'edificio',
    esEdificio: true,
    tipo,
    equipo,
    x,
    y,
    ancho: s.ancho,
    alto: s.alto,
    radio: Math.min(s.ancho, s.alto) / 2,
    hpMax: s.hp,
    hp: completo ? s.hp : 1,
    obra: completo ? 1 : 0,
    completo: !!completo,
    tiempoObra: tipo === 'casa' ? 10 : TIEMPO_OBRA,
    cola: [],
    producidos: 0,
    golpe: 0,
    muerto: false,
  };
  partida.edificios.push(b);
  return b;
}

function crearNodo(tipo, variante, x, y, cantidad, radio) {
  const n = {
    id: uid(),
    clase: 'nodo',
    tipo,
    variante,
    x,
    y,
    cantidad,
    cantidadMax: cantidad,
    radio,
    muerto: false,
    arboles: [],
  };
  if (variante === 'bosque') {
    const aleatorio = rng((Math.abs(x * 13 + y * 7) | 0) + 3);
    const total = 8;
    for (let i = 0; i < total; i++) {
      n.arboles.push({
        ox: (aleatorio() - 0.5) * radio * 1.8,
        oy: (aleatorio() - 0.5) * radio * 1.25,
        escala: 0.72 + aleatorio() * 0.55,
        tipo: (aleatorio() * 3) | 0,
      });
    }
  }
  partida.nodos.push(n);
  return n;
}

function crearPartida(opciones) {
  opciones = opciones || {};
  gesto = null;
  partida = {
    seq: 1,
    fase: 'jugando',
    resultado: null,
    cierreEn: 0,
    tiempo: 0,
    escala: 1,
    demo: false,
    auto: false,
    autoReloj: 0,
    autoAlternar: false,
    comida: 170,
    madera: 110,
    oro: 130,
    tope: TOPE_POBLACION,
    modo: 'normal',
    construir: 'cuartel',
    constructores: [],
    seleccion: [],
    unidades: [],
    edificios: [],
    nodos: [],
    particulas: [],
    disparos: [],
    textos: [],
    marcas: [],
    escombros: [],
    caidos: [],
    ia: {
      comida: 160,
      madera: 260,
      oro: 90,
      oleada: 0,
      oleadaEn: 300,
      olaInf: 0,
      olaCab: 0,
      reintentoCuartel: 8,
      cuartelesLevantados: 0,
      avisoCuartel: false,
      entrenados: 0,
      ataquePendiente: false,
      anunciada: 0,
      avisosOla: 0,
    },
  };
  sembrarMundo();
  if (opciones.demo) prepararDemo();
  else if (opciones.auto) prepararAuto();
  else {
    partida.seleccion = partida.unidades.filter((u) => u.equipo === 'patriota').map((u) => u.id);
    enfoque(490, 990, 1.05);
  }
  cache.comida = -1;
  cache.madera = -1;
  cache.oro = -1;
  cache.pob = '';
  cache.firma = '';
  cache.reloj = '';
  cache.pista = '';
  elFin.hidden = true;
  elFin.classList.remove('victoria', 'derrota');
}

function sembrarMundo() {
  crearEdificio('centro', 'patriota', CAMP.patriota.x, CAMP.patriota.y, true);
  crearEdificio('centro', 'realista', CAMP.realista.x, CAMP.realista.y, true);
  for (const n of NODOS) crearNodo(n[0], n[1], n[2], n[3], n[4], n[5]);
  const patriotas = [
    [360, 960],
    [490, 940],
    [540, 1000],
    [310, 1010],
  ];
  for (const p of patriotas) crearUnidad('aldeano', 'patriota', p[0], p[1]);
  const realistas = [
    ['comida', 1700, 210],
    ['madera', 1980, 230],
    ['oro', 1380, 430],
  ];
  for (const r of realistas) {
    const u = crearUnidad('aldeano', 'realista', r[1], r[2]);
    const nodo = nodoMasCercano(u, r[0]);
    if (nodo) {
      u.estado = 'recolectar';
      u.nodoId = nodo.id;
    }
  }
  const guarnicion = [
    ['fusilero_realista', 1710, 400],
    ['fusilero_realista', 1890, 390],
    ['fusilero_realista', 1800, 470],
    ['dragon', 1930, 450],
  ];
  for (const g of guarnicion) crearUnidad(g[0], 'realista', g[1], g[2]);
}

function prepararDemo() {
  partida.demo = true;
  partida.escala = 8;
  let cuartel = partida.edificios.find((b) => b.tipo === 'cuartel' && b.equipo === 'realista');
  if (!cuartel) cuartel = crearEdificio('cuartel', 'realista', 1680, 560, true);
  const centro = centroDe('realista');
  rodear(centro, 10);
  rodear(cuartel, 10);
  enfoque(1720, 460, 0.95);
  partida.seleccion = [];
}

function rodear(objetivo, n) {
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const dist = Math.max(objetivo.ancho, objetivo.alto) * 0.5 + 78;
    const u = crearUnidad(
      'fusilero',
      'patriota',
      objetivo.x + Math.cos(ang) * dist,
      objetivo.y + Math.sin(ang) * dist
    );
    u.estado = 'atacar';
    u.objetivoId = objetivo.id;
  }
}

function prepararAuto() {
  partida.auto = true;
  partida.escala = 18;
  partida.autoReloj = 0;
  partida.seleccion = [];
  enfoque(490, 990, 1.05);
}

function centroDe(equipo) {
  for (const b of partida.edificios) {
    if (b.tipo === 'centro' && b.equipo === equipo && !b.muerto && b.hp > 0 && b.completo) return b;
  }
  return null;
}

function nodoMasCercano(u, tipo) {
  let mejor = null;
  let mejorD = Infinity;
  for (const n of partida.nodos) {
    if (n.cantidad <= 0 || n.tipo !== tipo) continue;
    const d = Math.hypot(n.x - u.x, n.y - u.y);
    if (d < mejorD) {
      mejorD = d;
      mejor = n;
    }
  }
  return mejor;
}

function aldeanoMasCercano(equipo, x, y) {
  let mejor = null;
  let mejorD = Infinity;
  for (const u of partida.unidades) {
    if (u.muerto || u.equipo !== equipo || u.tipo !== 'aldeano') continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < mejorD) {
      mejorD = d;
      mejor = u;
    }
  }
  return mejor;
}

function contarMilitares(equipo) {
  let n = 0;
  for (const u of partida.unidades) {
    if (!u.muerto && u.equipo === equipo && u.tipo !== 'aldeano') n += 1;
  }
  return n;
}

function recalcularTope() {
  let casas = 0;
  for (const b of partida.edificios) {
    if (b.muerto || !b.completo || b.tipo !== 'casa' || b.equipo !== 'patriota') continue;
    casas += 1;
  }
  const maxCasas = Math.floor((TOPE_MAXIMO - TOPE_POBLACION) / TOPE_POR_CASA);
  partida.tope = TOPE_POBLACION + Math.min(casas, maxCasas) * TOPE_POR_CASA;
}

function calcularPoblacion() {
  let n = 0;
  for (const u of partida.unidades) {
    if (!u.muerto && u.equipo === 'patriota') n += u.poblacion;
  }
  for (const b of partida.edificios) {
    if (b.muerto || b.equipo !== 'patriota') continue;
    for (const item of b.cola) n += COSTO[item.tipo].poblacion || 1;
  }
  return n;
}

function puedePagar(costo) {
  return partida.comida >= (costo.comida || 0) &&
    partida.madera >= (costo.madera || 0) &&
    partida.oro >= (costo.oro || 0);
}

function pagar(costo) {
  if (!puedePagar(costo)) return false;
  partida.comida -= costo.comida || 0;
  partida.madera -= costo.madera || 0;
  partida.oro -= costo.oro || 0;
  return true;
}

function puedeEntrenarTipo(tipo) {
  const costo = COSTO[tipo];
  return !!costo && puedePagar(costo) && calcularPoblacion() + costo.poblacion <= partida.tope;
}

function holgura(u) {
  return u.radio * 0.42;
}

function bloqueado(x, y, u) {
  const pad = holgura(u);
  for (const b of partida.edificios) {
    if (b.muerto) continue;
    if (Math.abs(x - b.x) < b.ancho / 2 + pad && Math.abs(y - b.y) < b.alto / 2 + pad) return true;
  }
  return false;
}

function moverHacia(u, tx, ty, dt) {
  // Pasos cortos: un dt grande no atraviesa edificios. Si un muro tapa
  // el camino, el aldeano se corre de lado y lo bordea.
  const xAntes = u.x;
  const yAntes = u.y;
  let restante = u.velocidad * dt;
  let guard = 0;
  while (restante > 0.2 && guard < 64) {
    guard += 1;
    const dx = tx - u.x;
    const dy = ty - u.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) return true;
    const paso = Math.min(6, restante, dist);
    const ux = dx / dist;
    const uy = dy / dist;
    let nx = u.x + ux * paso;
    let ny = u.y + uy * paso;
    if (bloqueado(nx, ny, u)) {
      if (!bloqueado(u.x + ux * paso, u.y, u)) ny = u.y;
      else if (!bloqueado(u.x, u.y + uy * paso, u)) nx = u.x;
      else {
        let colocado = false;
        const signoBase = u.id % 2 === 0 ? 1 : -1;
        for (const distLado of [14, 26, 40]) {
          for (const signo of [signoBase, -signoBase]) {
            const sx = u.x - uy * distLado * signo;
            const sy = u.y + ux * distLado * signo;
            if (!bloqueado(sx, sy, u)) {
              nx = sx;
              ny = sy;
              colocado = true;
              break;
            }
          }
          if (colocado) break;
        }
        if (!colocado) break;
      }
    }
    if (Math.abs(nx - u.x) < 0.04 && Math.abs(ny - u.y) < 0.04) break;
    if (nx !== u.x) u.frente = nx >= u.x ? 1 : -1;
    u.x = nx;
    u.y = ny;
    restante -= paso;
  }
  if (Math.hypot(u.x - xAntes, u.y - yAntes) < 0.8 && Math.hypot(tx - u.x, ty - u.y) > 24) {
    u.atasco = (u.atasco || 0) + dt;
    if (u.atasco > 0.35) {
      const base = Math.atan2(ty - u.y, tx - u.x);
      const giro = (u.id % 2 === 0 ? 1 : -1) * (Math.PI / 2);
      for (const dist of [22, 38, 56]) {
        const px = u.x + Math.cos(base + giro) * dist;
        const py = u.y + Math.sin(base + giro) * dist;
        if (!bloqueado(px, py, u)) {
          u.x = px;
          u.y = py;
          u.frente = px >= xAntes ? 1 : -1;
          u.atasco = 0;
          break;
        }
      }
    }
  } else u.atasco = 0;
  return Math.hypot(tx - u.x, ty - u.y) < 3;
}

function separar() {
  const arr = partida.unidades;
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.muerto) continue;
    for (let j = i + 1; j < arr.length; j++) {
      const b = arr[j];
      if (b.muerto) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.radio + b.radio) * 0.72;
      if (d === 0) {
        a.x -= 0.6;
        b.x += 0.6;
        continue;
      }
      if (d < min) {
        const empuje = (min - d) * 0.35;
        dx /= d;
        dy /= d;
        a.x -= dx * empuje;
        a.y -= dy * empuje;
        b.x += dx * empuje;
        b.y += dy * empuje;
      }
    }
  }
}

function sacarDeEdificios(u) {
  for (const b of partida.edificios) {
    if (b.muerto) continue;
    const hw = b.ancho / 2 + holgura(u);
    const hh = b.alto / 2 + holgura(u);
    const dx = u.x - b.x;
    const dy = u.y - b.y;
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
      const px = hw - Math.abs(dx);
      const py = hh - Math.abs(dy);
      if (px < py) u.x += Math.sign(dx || 1) * px;
      else u.y += Math.sign(dy || 1) * py;
    }
  }
}

function ordenarMovimiento(lista, x, y) {
  if (!lista.length) return;
  const cols = Math.max(1, Math.ceil(Math.sqrt(lista.length)));
  const filas = Math.ceil(lista.length / cols);
  lista.forEach((u, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const ox = (c - (cols - 1) / 2) * 28;
    const oy = (r - (filas - 1) / 2) * 28;
    u.estado = 'mover';
    u.destino = {
      x: clamp(x + ox, u.radio + 6, MUNDO.w - u.radio - 6),
      y: clamp(y + oy, u.radio + 6, MUNDO.h - u.radio - 6),
    };
    u.objetivoId = null;
    u.asaltoId = null;
    u.nodoId = null;
  });
  marcar(x, y);
}

function ordenarRecoleccion(lista, nodo) {
  for (const u of lista) {
    u.estado = 'recolectar';
    u.nodoId = nodo.id;
    u.objetivoId = null;
    u.asaltoId = null;
    u.destino = null;
    u.temporizador = 0.2;
  }
}

function ordenarAtaque(lista, objetivo) {
  for (const u of lista) {
    u.estado = 'atacar';
    u.objetivoId = objetivo.id;
    u.asaltoId = null;
    u.destino = null;
    u.nodoId = null;
  }
}

function ordenarAsalto(u, objetivo) {
  u.estado = 'asalto';
  u.asaltoId = objetivo.id;
  u.objetivoId = objetivo.id;
  u.destino = null;
  u.nodoId = null;
}

function marcar(x, y) {
  partida.marcas.push({ x, y, vida: 0.55, max: 0.55 });
}

function textoFlotante(x, y, texto, tipo) {
  if (partida.textos.length > 48) partida.textos.shift();
  const color = tipo === 'comida' ? '#d7ec9a'
    : tipo === 'madera' ? '#f0d0a0'
      : tipo === 'oro' ? '#ffe08a'
        : '#ffd0c8';
  partida.textos.push({ x, y, texto, vida: 0.85, max: 0.85, color });
}

function explosion(x, y, color, n, velocidad) {
  for (let i = 0; i < n; i++) {
    if (partida.particulas.length > 140) partida.particulas.shift();
    const a = Math.random() * Math.PI * 2;
    const v = velocidad * (0.35 + Math.random());
    partida.particulas.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      vida: 0.35 + Math.random() * 0.4,
      max: 0.75,
      color,
      tam: 2 + Math.random() * 3,
    });
  }
}

function depositar(unidad, cantidad, tipo) {
  if (!tipo || cantidad <= 0) return;
  if (unidad.equipo === 'patriota') {
    partida[tipo] += cantidad;
    textoFlotante(unidad.x, unidad.y - 20, '+' + cantidad, tipo);
  } else {
    partida.ia[tipo] += cantidad;
  }
}

function morir(ent) {
  if (!ent || ent.muerto) return;
  ent.muerto = true;
  ent.hp = 0;
  if (ent.esEdificio) {
    if (ent.equipo === 'patriota') {
      for (const item of ent.cola) {
        const costo = COSTO[item.tipo];
        partida.comida += Math.floor((costo.comida || 0) * 0.5);
        partida.madera += Math.floor((costo.madera || 0) * 0.5);
        partida.oro += Math.floor((costo.oro || 0) * 0.5);
      }
      if (!ent.completo && (ent.tipo === 'cuartel' || ent.tipo === 'casa')) {
        const costo = COSTO[ent.tipo];
        partida.madera += Math.floor((costo.madera || 0) * 0.5);
        if (partida.fase === 'jugando') {
          aviso(ent.tipo === 'casa'
            ? 'La casa fue destruida. Recuperas la mitad de la madera.'
            : 'El cuartel fue destruido. Recuperas la mitad de la madera.');
        }
      }
    }
    if (ent.equipo === 'realista' && ent.tipo === 'cuartel' && partida.ia) {
      partida.ia.reintentoCuartel = 20;
    }
    ent.cola = [];
    partida.escombros.push({
      x: ent.x,
      y: ent.y,
      w: ent.ancho,
      h: ent.alto,
      vida: 14,
      equipo: ent.equipo,
      tipo: ent.tipo,
    });
    partida.caidos.push({ tipo: ent.tipo, equipo: ent.equipo });
    if (ent.tipo === 'casa' && ent.equipo === 'patriota') recalcularTope();
    explosion(ent.x, ent.y, ent.equipo === 'patriota' ? '#8eb4e8' : '#e08080', 16, 80);
    explosion(ent.x, ent.y, '#e7d3a8', 10, 48);
  } else if (ent.esUnidad) {
    explosion(ent.x, ent.y, '#6b4428', 7, 36);
  }
}

function infligir(atacante, objetivo) {
  if (!objetivo || objetivo.muerto || objetivo.hp <= 0) return;
  let dano = atacante.dano;
  if (atacante.tipo === 'lancero' && objetivo.tipo === 'dragon') dano += 14;
  if (atacante.equipo === 'realista' && objetivo.esEdificio) dano = Math.max(1, Math.round(dano * 0.4));
  objetivo.hp -= dano;
  objetivo.golpe = 0.12;
  textoFlotante(objetivo.x, objetivo.y - (objetivo.radio || 24) - 8, '-' + dano, 'dano');
  if (atacante.alcance > 40) {
    if (partida.disparos.length > 36) partida.disparos.shift();
    partida.disparos.push({
      x: atacante.x + atacante.frente * 8,
      y: atacante.y - 6,
      tx: objetivo.x,
      ty: objetivo.y - 4,
      vida: 0.1,
      max: 0.1,
    });
  }
  if (objetivo.hp <= 0) morir(objetivo);
}

function enemigoCercano(u, radio, soloMilitares) {
  let mejor = null;
  let mejorD = radio;
  const considerar = (ent) => {
    if (!ent || ent.muerto || ent.hp <= 0 || ent.equipo === u.equipo || !ent.equipo) return;
    if (soloMilitares && (!ent.esUnidad || ent.tipo === 'aldeano')) return;
    const d = ent.esEdificio
      ? distanciaAlBorde(u, ent)
      : Math.hypot(ent.x - u.x, ent.y - u.y) - ent.radio;
    if (d < mejorD) {
      mejorD = d;
      mejor = ent;
    }
  };
  for (const otro of partida.unidades) considerar(otro);
  if (!soloMilitares) for (const ed of partida.edificios) considerar(ed);
  return mejor;
}

function edificioHostilMasCercano(u, radioMax) {
  let mejor = null;
  let mejorD = radioMax;
  for (const b of partida.edificios) {
    if (b.muerto || b.hp <= 0 || b.equipo === u.equipo) continue;
    const d = Math.hypot(b.x - u.x, b.y - u.y);
    if (d < mejorD) {
      mejorD = d;
      mejor = b;
    }
  }
  return mejor;
}

function combatir(u, objetivo, dt) {
  if (distanciaAlBorde(u, objetivo) > u.alcance) {
    moverHacia(u, objetivo.x, objetivo.y, dt);
    return;
  }
  u.frente = objetivo.x >= u.x ? 1 : -1;
  u.recarga -= dt;
  if (u.recarga <= 0) {
    u.recarga = u.cadencia;
    infligir(u, objetivo);
  }
}

function actualizarRecoleccion(u, dt) {
  let nodo = porId(u.nodoId);
  if (!nodo || nodo.cantidad <= 0) {
    nodo = nodoMasCercano(u, u.cargaTipo || 'comida');
    if (nodo && u.carga < u.cargaMax) u.nodoId = nodo.id;
    else {
      u.estado = u.carga > 0 ? 'entregar' : 'quieto';
      return;
    }
  }
  if (u.carga > 0 && u.cargaTipo && u.cargaTipo !== nodo.tipo) {
    u.estado = 'entregar';
    return;
  }
  if (Math.hypot(nodo.x - u.x, nodo.y - u.y) > nodo.radio + 8) {
    moverHacia(u, nodo.x, nodo.y, dt);
    return;
  }
  u.frente = nodo.x >= u.x ? 1 : -1;
  u.temporizador -= dt;
  if (u.temporizador > 0) return;
  const ritmo = ritmoRecoleccion(nodo.tipo);
  u.temporizador = ritmo.cada;
  const tope = ritmo.carga;
  const toma = Math.min(ritmo.toma, tope - u.carga, nodo.cantidad);
  if (toma <= 0) {
    u.estado = u.carga > 0 ? 'entregar' : 'quieto';
    return;
  }
  nodo.cantidad -= toma;
  u.carga += toma;
  u.cargaTipo = nodo.tipo;
  if (u.carga >= tope || nodo.cantidad <= 0) u.estado = 'entregar';
}

function ritmoRecoleccion(tipo) {
  if (tipo === 'comida') return { cada: 0.95, toma: 4, carga: 14 };
  if (tipo === 'madera') return { cada: 0.75, toma: 6, carga: 18 };
  return { cada: 1.45, toma: 3, carga: 9 };
}

function actualizarEntrega(u, dt) {
  const tc = centroDe(u.equipo);
  if (!tc) {
    u.estado = 'quieto';
    return;
  }
  if (distanciaAlBorde(u, tc) > 18) {
    moverHacia(u, tc.x, tc.y, dt);
    return;
  }
  if (u.carga > 0 && u.cargaTipo) depositar(u, u.carga, u.cargaTipo);
  u.carga = 0;
  u.cargaTipo = null;
  let nodo = porId(u.nodoId);
  if (!nodo || nodo.cantidad <= 0) nodo = null;
  if (nodo) {
    u.nodoId = nodo.id;
    u.estado = 'recolectar';
    u.temporizador = 0.15;
  } else {
    u.estado = 'quieto';
    u.nodoId = null;
  }
}

function actualizarConstruccion(u, dt) {
  const b = porId(u.objetivoId);
  if (!b || b.muerto || !b.esEdificio) {
    u.estado = 'quieto';
    u.objetivoId = null;
    return;
  }
  if (b.completo) {
    u.estado = 'quieto';
    u.objetivoId = null;
    return;
  }
  if (distanciaAlBorde(u, b) > 20) {
    moverHacia(u, b.x, b.y, dt);
    return;
  }
  u.frente = b.x >= u.x ? 1 : -1;
  const antes = b.obra;
  b.obra = Math.min(1, b.obra + dt / (b.tiempoObra || TIEMPO_OBRA));
  const tope = Math.max(1, b.hpMax * b.obra);
  if (b.hp >= b.hpMax * antes - 1) b.hp = tope;
  else b.hp = Math.min(b.hp, tope);
  if (b.obra >= 1) {
    b.obra = 1;
    b.completo = true;
    b.hp = b.hpMax;
    u.estado = 'quieto';
    u.objetivoId = null;
    if (b.equipo === 'patriota' && b.tipo === 'casa') {
      recalcularTope();
      aviso('La casa está lista. El tope de población sube.');
    } else if (b.equipo === 'patriota' && b.tipo === 'cuartel') {
      aviso('El cuartel está listo. Entrena fusileros y lanceros.');
    }
  }
}

function retomarAtaque(u) {
  const persona = enemigoCercano(u, u.aggro, false);
  const edificio = edificioHostilMasCercano(u, 460);
  let otro = null;
  if (persona && edificio) {
    const dp = Math.hypot(persona.x - u.x, persona.y - u.y);
    const de = Math.hypot(edificio.x - u.x, edificio.y - u.y);
    otro = dp < de ? persona : edificio;
  } else otro = persona || edificio;
  if (otro) {
    u.objetivoId = otro.id;
    return otro;
  }
  u.estado = 'quieto';
  u.objetivoId = null;
  return null;
}

function actualizarAtaque(u, dt) {
  let objetivo = porId(u.objetivoId);
  if (!objetivo || objetivo.muerto || objetivo.hp <= 0 || objetivo.equipo === u.equipo) {
    objetivo = retomarAtaque(u);
    if (!objetivo) return;
  }
  combatir(u, objetivo, dt);
}

function actualizarAsalto(u, dt) {
  const amenaza = enemigoCercano(u, 168, true);
  let objetivo = amenaza;
  if (!objetivo) {
    objetivo = porId(u.asaltoId);
    if (!objetivo || objetivo.muerto || objetivo.hp <= 0) {
      const tc = centroDe(oponente(u.equipo));
      objetivo = tc || edificioHostilMasCercano(u, 5000);
      if (!objetivo) {
        u.estado = 'quieto';
        return;
      }
      u.asaltoId = objetivo.id;
    }
  }
  u.objetivoId = objetivo.id;
  combatir(u, objetivo, dt);
}

function pensarQuieto(u) {
  if (u.tipo === 'aldeano') {
    if (u.carga > 0) u.estado = 'entregar';
    return;
  }
  const enemigo = enemigoCercano(u, u.aggro, false);
  if (enemigo) {
    u.estado = 'atacar';
    u.objetivoId = enemigo.id;
  }
}

function actualizarUnidad(u, dt) {
  if (u.muerto || u.hp <= 0) return;
  if ((u.tipo === 'lancero' || u.tipo === 'dragon') && u.estado !== 'quieto') {
    u.polvo -= dt;
    if (u.polvo <= 0 && partida.particulas.length < 100) {
      u.polvo = 0.16;
      partida.particulas.push({
        x: u.x - u.frente * 10,
        y: u.y + 6,
        vx: -u.frente * 10,
        vy: 6,
        vida: 0.32,
        max: 0.32,
        color: 'rgba(92,74,42,0.65)',
        tam: 3,
      });
    }
  }
  if (u.estado === 'mover') {
    if (!u.destino || moverHacia(u, u.destino.x, u.destino.y, dt)) {
      u.estado = 'quieto';
      u.destino = null;
    }
  } else if (u.estado === 'recolectar') actualizarRecoleccion(u, dt);
  else if (u.estado === 'entregar') actualizarEntrega(u, dt);
  else if (u.estado === 'construir') actualizarConstruccion(u, dt);
  else if (u.estado === 'atacar') actualizarAtaque(u, dt);
  else if (u.estado === 'asalto') actualizarAsalto(u, dt);
  else pensarQuieto(u);
}

function puntoAparicion(b, indice) {
  const ang = Math.atan2(MUNDO.h * 0.55 - b.y, MUNDO.w * 0.45 - b.x);
  const dist = Math.max(b.ancho, b.alto) * 0.55 + 18;
  const lateral = (indice % 5) - 2;
  return {
    x: clamp(b.x + Math.cos(ang) * dist - Math.sin(ang) * lateral * 16, 20, MUNDO.w - 20),
    y: clamp(b.y + Math.sin(ang) * dist + Math.cos(ang) * lateral * 16, 20, MUNDO.h - 20),
  };
}

function actualizarColas(dt) {
  for (const b of partida.edificios) {
    if (b.muerto || !b.completo || !b.cola.length) continue;
    const item = b.cola[0];
    item.restante -= dt;
    if (item.restante > 0) continue;
    b.cola.shift();
    b.producidos += 1;
    const p = puntoAparicion(b, b.producidos);
    const u = crearUnidad(item.tipo, b.equipo, p.x, p.y);
    if (b.equipo === 'realista' && u.tipo !== 'aldeano') {
      const lejos = puntoAparicion(b, b.producidos + 2);
      u.estado = 'mover';
      u.destino = lejos;
      despacharOla();
    } else {
      const lejos = puntoAparicion(b, b.producidos + 2);
      u.estado = 'mover';
      u.destino = lejos;
    }
  }
}

function planOleada(n) {
  if (n <= 1) return { inf: 2, cab: 0 };
  if (n === 2) return { inf: 3, cab: 1 };
  if (n === 3) return { inf: 4, cab: 1 };
  if (n === 4) return { inf: 4, cab: 2 };
  return { inf: Math.min(6, 3 + n), cab: 2 };
}

function reservaGuarnicion() {
  const t = partida.tiempo;
  if (t < 240) return 5;
  if (t < 480) return 7;
  if (t < 780) return 9;
  return 11;
}

function casaRealista() {
  const lista = [];
  for (const u of partida.unidades) {
    if (u.muerto || u.equipo !== 'realista' || u.tipo === 'aldeano' || u.estado === 'asalto') continue;
    lista.push(u);
  }
  return lista;
}

function cupoEntrenamiento() {
  const ia = partida.ia;
  const pendiente = (ia.olaInf || 0) + (ia.olaCab || 0);
  let prep = 0;
  if (!pendiente) {
    const sig = planOleada(ia.oleada + 1);
    prep = sig.inf + sig.cab;
  }
  return reservaGuarnicion() + pendiente + prep;
}

function buscarSitioRealista() {
  for (const s of SITIOS_REALISTAS) if (posicionValida(s.x, s.y)) return s;
  return null;
}

function anclasRealistas() {
  const lista = [];
  for (const b of partida.edificios) {
    if (!b.muerto && b.equipo === 'realista' && (b.tipo === 'centro' || b.tipo === 'cuartel')) lista.push(b);
  }
  return lista;
}

function amenazaCercaDeRealistas() {
  const anclas = anclasRealistas();
  if (!anclas.length) return null;
  let mejor = null;
  let mejorD = 460;
  for (const u of partida.unidades) {
    if (u.muerto || u.equipo !== 'patriota' || u.tipo === 'aldeano') continue;
    for (const ancla of anclas) {
      const d = Math.hypot(u.x - ancla.x, u.y - ancla.y);
      if (d < mejorD) {
        mejorD = d;
        mejor = u;
      }
    }
  }
  return mejor;
}

function responderDefensa(amenaza) {
  for (const u of partida.unidades) {
    if (u.muerto || u.equipo !== 'realista' || u.tipo === 'aldeano') continue;
    if (u.estado === 'asalto') continue;
    if (u.estado !== 'quieto' && u.estado !== 'mover' && u.estado !== 'atacar') continue;
    u.estado = 'atacar';
    u.objetivoId = amenaza.id;
    u.asaltoId = null;
    u.destino = null;
  }
}

function anunciarOla(enviados) {
  const ia = partida.ia;
  if (!enviados || ia.anunciada === ia.oleada) return;
  ia.anunciada = ia.oleada;
  ia.avisosOla = (ia.avisosOla || 0) + 1;
  aviso(ia.oleada === 1 ? 'Se acerca una avanzada realista.' : 'Otra oleada realista marcha hacia tu centro.');
}

function despacharOla() {
  const ia = partida.ia;
  if (!ia || ((ia.olaInf || 0) <= 0 && (ia.olaCab || 0) <= 0)) {
    if (ia) ia.ataquePendiente = false;
    return;
  }
  const tc = centroDe('patriota');
  if (!tc) return;
  const casa = casaRealista();
  const reserva = reservaGuarnicion();
  if (casa.length <= reserva) {
    ia.ataquePendiente = true;
    return;
  }
  const sobrantes = casa.slice(reserva);
  let enviados = 0;
  for (const u of sobrantes) {
    const esCab = u.tipo === 'dragon';
    const mandaInf = !esCab && ia.olaInf > 0;
    const mandaCab = esCab && ia.olaCab > 0;
    const relleno = (!esCab && ia.olaInf <= 0 && ia.olaCab > 0) || (esCab && ia.olaCab <= 0 && ia.olaInf > 0);
    if (!mandaInf && !mandaCab && !relleno) continue;
    ordenarAsalto(u, tc);
    enviados += 1;
    if (esCab && ia.olaCab > 0) ia.olaCab -= 1;
    else if (!esCab && ia.olaInf > 0) ia.olaInf -= 1;
    else if (esCab) ia.olaInf -= 1;
    else ia.olaCab -= 1;
  }
  ia.ataquePendiente = ia.olaInf > 0 || ia.olaCab > 0;
  anunciarOla(enviados);
}

function lanzarOleada() {
  const ia = partida.ia;
  ia.oleada += 1;
  const plan = planOleada(ia.oleada);
  ia.olaInf = Math.min(8, (ia.olaInf || 0) + plan.inf);
  ia.olaCab = Math.min(4, (ia.olaCab || 0) + plan.cab);
  ia.oleadaEn = 120;
  ia.ataquePendiente = true;
  despacharOla();
}

function entrenarIA(cuartel) {
  if (!cuartel || !cuartel.completo || cuartel.muerto) return;
  const ia = partida.ia;
  if (cuartel.cola.length >= 2) return;
  if (contarMilitares('realista') + cuartel.cola.length >= 22) return;
  if (casaRealista().length + cuartel.cola.length >= cupoEntrenamiento()) return;
  const dragones = casaRealista().filter((u) => u.tipo === 'dragon').length;
  const quiereCaballeria = ia.olaCab > dragones || ia.entrenados % 4 === 3;
  const opciones = quiereCaballeria ? ['dragon', 'fusilero_realista'] : ['fusilero_realista', 'dragon'];
  for (const tipo of opciones) {
    const costo = COSTO[tipo];
    if (ia.comida < (costo.comida || 0) || ia.madera < (costo.madera || 0) || ia.oro < (costo.oro || 0)) continue;
    ia.comida -= costo.comida || 0;
    ia.madera -= costo.madera || 0;
    ia.oro -= costo.oro || 0;
    cuartel.cola.push({ tipo, restante: costo.tiempo, total: costo.tiempo });
    ia.entrenados += 1;
    return;
  }
}

function actualizarIA(dt) {
  if (partida.demo) return;
  const ia = partida.ia;
  ia.comida += 3.6 * dt;
  ia.madera += 2.2 * dt;
  ia.oro += 2.8 * dt;
  const intruso = amenazaCercaDeRealistas();
  if (intruso) responderDefensa(intruso);
  ia.reintentoCuartel -= dt;
  ia.oleadaEn -= dt;
  let cuartel = null;
  for (const b of partida.edificios) {
    if (!b.muerto && b.tipo === 'cuartel' && b.equipo === 'realista') cuartel = b;
  }
  if (!cuartel && ia.cuartelesLevantados < 3 && ia.reintentoCuartel <= 0 && ia.madera >= COSTO.cuartel.madera) {
    const sitio = buscarSitioRealista();
    if (sitio) {
      ia.madera -= COSTO.cuartel.madera;
      cuartel = crearEdificio('cuartel', 'realista', sitio.x, sitio.y, false);
      ia.cuartelesLevantados += 1;
      const aldeano = aldeanoMasCercano('realista', sitio.x, sitio.y);
      if (aldeano) {
        aldeano.estado = 'construir';
        aldeano.objetivoId = cuartel.id;
        aldeano.nodoId = null;
        aldeano.destino = null;
      }
      if (!ia.avisoCuartel) {
        ia.avisoCuartel = true;
        aviso('Los realistas están levantando un cuartel.');
      }
    } else ia.reintentoCuartel = 5;
  }
  if (cuartel && !cuartel.completo) {
    let hayAlbañil = false;
    for (const u of partida.unidades) {
      if (!u.muerto && u.estado === 'construir' && u.objetivoId === cuartel.id) hayAlbañil = true;
    }
    if (!hayAlbañil) {
      const aldeano = aldeanoMasCercano('realista', cuartel.x, cuartel.y);
      if (aldeano) {
        aldeano.estado = 'construir';
        aldeano.objetivoId = cuartel.id;
        aldeano.nodoId = null;
      }
    }
  }
  entrenarIA(cuartel);
  if (ia.oleadaEn <= 0) lanzarOleada();
  else despacharOla();
}

function actualizarAuto(dt) {
  if (!partida.auto || partida.fase !== 'jugando') return;
  partida.autoReloj -= dt;
  if (partida.autoReloj > 0) return;
  partida.autoReloj = 1.15;
  const aldeanos = [];
  const militares = [];
  for (const u of partida.unidades) {
    if (u.muerto || u.equipo !== 'patriota') continue;
    if (u.tipo === 'aldeano') aldeanos.push(u);
    else militares.push(u);
  }
  let cuartel = null;
  for (const b of partida.edificios) {
    if (!b.muerto && b.equipo === 'patriota' && b.tipo === 'cuartel') cuartel = b;
  }
  const trabajos = ['oro', 'oro', 'madera', 'comida'];
  for (const a of aldeanos) {
    if (a.estado === 'construir') continue;
    const tipo = cuartel ? trabajos[aldeanos.indexOf(a) % 4] : 'madera';
    const nodoActual = porId(a.nodoId);
    const malNodo = !nodoActual || nodoActual.tipo !== tipo || nodoActual.cantidad <= 0;
    if (a.estado === 'quieto' || (a.estado === 'recolectar' && a.carga === 0 && malNodo)) {
      const nodo = nodoMasCercano(a, tipo);
      if (nodo) ordenarRecoleccion([a], nodo);
    }
  }
  if (!cuartel && puedePagar(COSTO.cuartel) && aldeanos.length) {
    for (const s of SITIOS_PATRIOTAS) {
      if (!posicionValida(s.x, s.y)) continue;
      partida.constructores = aldeanos.map((a) => a.id);
      intentarColocar(s.x, s.y);
      break;
    }
  }
  if (cuartel && cuartel.completo) {
    if (puedeEntrenarTipo('fusilero')) entrenar(cuartel, 'fusilero');
    else if (partida.oro >= 90 && puedeEntrenarTipo('lancero')) entrenar(cuartel, 'lancero');
  }
  const tc = centroDe('patriota');
  let amenaza = null;
  if (tc) {
    let mejor = 420;
    for (const u of partida.unidades) {
      if (u.muerto || u.equipo !== 'realista' || u.tipo === 'aldeano') continue;
      const d = Math.hypot(u.x - tc.x, u.y - tc.y);
      if (d < mejor) {
        mejor = d;
        amenaza = u;
      }
    }
  }
  const ociosos = militares.filter((m) => m.estado === 'quieto' || m.estado === 'mover');
  if (amenaza && !partida.autoAsalto && ociosos.length) {
    ordenarAtaque(ociosos, amenaza);
    return;
  }
  let cuartelEnemigo = null;
  for (const b of partida.edificios) {
    if (!b.muerto && b.equipo === 'realista' && b.tipo === 'cuartel') cuartelEnemigo = b;
  }
  const centroEnemigo = centroDe('realista');
  if (!centroEnemigo && !cuartelEnemigo) return;
  if (!partida.autoAsalto) {
    if (ociosos.length < 6) return;
    partida.autoAsalto = true;
    const pares = militares.filter((_, i) => i % 2 === 0);
    const impares = militares.filter((_, i) => i % 2 === 1);
    if (centroEnemigo) ordenarAtaque(pares, centroEnemigo);
    if (cuartelEnemigo) ordenarAtaque(impares.length ? impares : pares, cuartelEnemigo);
    else if (centroEnemigo) ordenarAtaque(impares, centroEnemigo);
    return;
  }
  const pendiente = [centroEnemigo, cuartelEnemigo].filter(Boolean).sort((a, b) => b.hp - a.hp)[0];
  for (const m of militares) {
    const actual = porId(m.objetivoId);
    const sigue = actual && !actual.muerto && actual.hp > 0 && actual.esEdificio && actual.equipo === 'realista';
    if (!sigue) ordenarAtaque([m], pendiente);
  }
}

function recogerMuertos() {
  partida.unidades = partida.unidades.filter((u) => !u.muerto);
  partida.edificios = partida.edificios.filter((b) => !b.muerto);
  partida.nodos = partida.nodos.filter((n) => n.cantidad > 0);
  partida.seleccion = partida.seleccion.filter((id) => {
    const e = porId(id);
    return !!e && !e.muerto;
  });
}

function comprobarFin() {
  if (partida.fase !== 'jugando') return;
  let centroPatriota = false;
  let centroRealista = false;
  let cuartelRealista = false;
  for (const b of partida.edificios) {
    if (b.muerto || b.hp <= 0) continue;
    if (b.tipo === 'centro' && b.equipo === 'patriota') centroPatriota = true;
    if (b.tipo === 'centro' && b.equipo === 'realista') centroRealista = true;
    if (b.tipo === 'cuartel' && b.equipo === 'realista') cuartelRealista = true;
  }
  if (!centroPatriota) {
    partida.fase = 'resolviendo';
    partida.resultado = 'derrota';
    partida.cierreEn = 0.7;
    return;
  }
  if (!centroRealista && !cuartelRealista) {
    partida.fase = 'resolviendo';
    partida.resultado = 'victoria';
    partida.cierreEn = 0.7;
  }
}

function edificioVivo(equipo, tipo) {
  for (const b of partida.edificios) {
    if (b.muerto || b.hp <= 0) continue;
    if (b.equipo === equipo && b.tipo === tipo) return true;
  }
  return false;
}

function edificioCayo(equipo, tipo) {
  for (const c of partida.caidos) {
    if (c.equipo === equipo && c.tipo === tipo) return true;
  }
  return false;
}

function fraseEdificio(equipo, tipo, nombre) {
  if (edificioVivo(equipo, tipo)) return nombre + ' sigue en pie';
  if (edificioCayo(equipo, tipo)) return nombre + ' está en ruinas';
  return nombre + ' no se llegó a levantar';
}

function abrirFin() {
  if (partida.fase === 'victoria' || partida.fase === 'derrota') return;
  const resultado = partida.resultado === 'victoria' ? 'victoria' : 'derrota';
  partida.fase = resultado;
  elFin.hidden = false;
  elFin.classList.remove('victoria', 'derrota');
  elFin.classList.add(resultado);
  if (resultado === 'victoria') {
    elFinTitulo.textContent = '¡Victoria!';
    elFinTexto.textContent = 'El centro urbano realista está en ruinas y su cuartel está en ruinas. ' +
      fraseEdificio('patriota', 'centro', 'Tu centro urbano') + '.';
  } else {
    elFinTitulo.textContent = 'Derrota';
    elFinTexto.textContent = 'Tu centro urbano ha sido destruido. ' +
      fraseEdificio('patriota', 'cuartel', 'Tu cuartel') + '. ' +
      fraseEdificio('realista', 'centro', 'El centro urbano realista') + ' y ' +
      fraseEdificio('realista', 'cuartel', 'su cuartel') + '.';
  }
}

function actualizarVisuales(dt) {
  for (const e of partida.unidades) if (e.golpe > 0) e.golpe -= dt;
  for (const e of partida.edificios) if (e.golpe > 0) e.golpe -= dt;
  for (const p of partida.particulas) {
    p.vida -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  partida.particulas = partida.particulas.filter((p) => p.vida > 0);
  for (const d of partida.disparos) d.vida -= dt;
  partida.disparos = partida.disparos.filter((d) => d.vida > 0);
  for (const t of partida.textos) {
    t.vida -= dt;
    t.y -= 16 * dt;
  }
  partida.textos = partida.textos.filter((t) => t.vida > 0);
  for (const m of partida.marcas) m.vida -= dt;
  partida.marcas = partida.marcas.filter((m) => m.vida > 0);
  for (const e of partida.escombros) e.vida -= dt;
  partida.escombros = partida.escombros.filter((e) => e.vida > 0);
}

function actualizarBorde(dtReal) {
  if (partida.fase === 'victoria' || partida.fase === 'derrota') return;
  let dx = 0;
  let dy = 0;
  if (gesto && gesto.modo === 'borde' && punteros.size === 1) {
    const p = punteros.values().next().value;
    const dir = vectorBorde(p.x, p.y, MARGEN_BORDE_TACTIL);
    dx += dir.x;
    dy += dir.y;
  }
  if (mouse && punteros.size === 0 && !sobreControl(mouse.x, mouse.y)) {
    const dir = vectorBorde(mouse.x, mouse.y, MARGEN_BORDE_RATON);
    dx += dir.x;
    dy += dir.y;
  }
  for (const tecla of teclas) {
    const vector = teclaCamara(tecla);
    if (!vector) continue;
    dx += vector[0];
    dy += vector[1];
  }
  if (!dx && !dy) return;
  const n = Math.hypot(dx, dy) || 1;
  cam.x += (dx / n) * 540 * dtReal / cam.zoom;
  cam.y += (dy / n) * 540 * dtReal / cam.zoom;
  clampCamara();
}

function paso(dtReal) {
  const dt = dtReal * partida.escala;
  actualizarBorde(dtReal);
  if (partida.fase === 'jugando') {
    partida.tiempo += dt;
    actualizarIA(dt);
    actualizarAuto(dt);
    for (const u of partida.unidades) actualizarUnidad(u, dt);
    actualizarColas(dt);
    separar();
    for (const u of partida.unidades) {
      if (u.muerto) continue;
      sacarDeEdificios(u);
      u.x = clamp(u.x, u.radio, MUNDO.w - u.radio);
      u.y = clamp(u.y, u.radio, MUNDO.h - u.radio);
    }
    for (const ent of partida.unidades) {
      if (!ent.muerto && ent.hp <= 0) morir(ent);
    }
    for (const ent of partida.edificios) {
      if (!ent.muerto && ent.hp <= 0) morir(ent);
    }
    recogerMuertos();
    comprobarFin();
  } else if (partida.fase === 'resolviendo') {
    partida.cierreEn -= dtReal;
    if (partida.cierreEn <= 0) abrirFin();
  }
  actualizarVisuales(dtReal);
  if (elTiempo) {
    const reloj = textoReloj(partida.tiempo);
    if (elTiempo.textContent !== reloj) elTiempo.textContent = reloj;
  }
}

function posicionValida(x, y, tipo) {
  const spec = EDIF[tipo || 'cuartel'] || EDIF.cuartel;
  const ancho = spec.ancho;
  const alto = spec.alto;
  const rect = { x, y, ancho, alto };
  const m = 16;
  if (x - ancho / 2 < m || y - alto / 2 < m || x + ancho / 2 > MUNDO.w - m || y + alto / 2 > MUNDO.h - m) return false;
  for (const b of partida.edificios) {
    if (b.muerto) continue;
    if (Math.abs(b.x - x) < (b.ancho + ancho) / 2 + 12 && Math.abs(b.y - y) < (b.alto + alto) / 2 + 12) return false;
  }
  for (const n of partida.nodos) {
    if (n.cantidad <= 0) continue;
    if (circuloTocaRect(n.x, n.y, n.radio + 6, rect)) return false;
  }
  return true;
}

function intentarColocar(x, y) {
  if (partida.fase !== 'jugando') return;
  const tipo = partida.construir === 'casa' ? 'casa' : 'cuartel';
  const costo = COSTO[tipo];
  if (!puedePagar(costo)) {
    aviso(faltaRecurso(costo) || 'Falta madera');
    return;
  }
  if (tipo === 'casa' && casasPatriotas() >= Math.floor((TOPE_MAXIMO - TOPE_POBLACION) / TOPE_POR_CASA)) {
    aviso('La población ya está al máximo.');
    partida.modo = 'normal';
    return;
  }
  if (!posicionValida(x, y, tipo)) {
    aviso('No se puede construir ahí.');
    return;
  }
  const elegidos = [];
  for (const id of partida.constructores) {
    const u = porId(id);
    if (u && !u.muerto && u.tipo === 'aldeano' && u.equipo === 'patriota') elegidos.push(u);
  }
  let quienes = elegidos;
  if (!quienes.length) {
    const cercano = aldeanoMasCercano('patriota', x, y);
    if (cercano) quienes = [cercano];
  }
  if (!quienes.length) {
    aviso('Necesitas un aldeano.');
    partida.modo = 'normal';
    return;
  }
  pagar(costo);
  const b = crearEdificio(tipo, 'patriota', x, y, false);
  for (const a of quienes) {
    a.estado = 'construir';
    a.objetivoId = b.id;
    a.nodoId = null;
    a.destino = null;
    a.asaltoId = null;
  }
  partida.modo = 'normal';
  partida.constructores = [];
  partida.seleccion = [b.id];
  aviso(tipo === 'casa' ? 'Los aldeanos están levantando la casa.' : 'Los aldeanos están levantando el cuartel.');
}

function casasPatriotas() {
  let n = 0;
  for (const b of partida.edificios) {
    if (!b.muerto && b.tipo === 'casa' && b.equipo === 'patriota') n += 1;
  }
  return n;
}

function faltaRecurso(costo) {
  const faltan = [];
  if ((costo.comida || 0) > partida.comida) faltan.push('comida');
  if ((costo.madera || 0) > partida.madera) faltan.push('madera');
  if ((costo.oro || 0) > partida.oro) faltan.push('oro');
  if (!faltan.length) return '';
  if (faltan.length === 1) return 'Falta ' + faltan[0];
  if (faltan.length === 2) return 'Falta ' + faltan[0] + ' y ' + faltan[1];
  return 'Falta ' + faltan.slice(0, -1).join(', ') + ' y ' + faltan[faltan.length - 1];
}

function empezarColocacion(tipo) {
  const obra = tipo === 'casa' ? 'casa' : 'cuartel';
  if (obra === 'casa' && casasPatriotas() >= Math.floor((TOPE_MAXIMO - TOPE_POBLACION) / TOPE_POR_CASA)) {
    aviso('La población ya está al máximo.');
    return;
  }
  if (!puedePagar(COSTO[obra])) {
    aviso(faltaRecurso(COSTO[obra]) || 'Falta madera');
    return;
  }
  const aldeanos = [];
  for (const id of partida.seleccion) {
    const e = porId(id);
    if (e && e.tipo === 'aldeano' && e.equipo === 'patriota' && !e.muerto) aldeanos.push(e);
  }
  if (!aldeanos.length) {
    aviso('Selecciona un aldeano.');
    return;
  }
  partida.constructores = aldeanos.map((a) => a.id);
  partida.construir = obra;
  partida.modo = 'colocar';
  punteroMundo = { x: aldeanos[0].x + 90, y: aldeanos[0].y - 10 };
  aviso(obra === 'casa' ? 'Toca el terreno para colocar la casa.' : 'Toca el terreno para colocar el cuartel.');
}

function cancelarColocacion() {
  if (partida.modo !== 'colocar') return;
  partida.modo = 'normal';
  if (partida.constructores.length) partida.seleccion = partida.constructores.slice();
  partida.constructores = [];
}

function entrenar(edificio, tipo, silencioso) {
  if (partida.fase !== 'jugando' || !edificio || edificio.muerto) return false;
  if (!edificio.completo) {
    if (!silencioso) aviso('El edificio aún se está construyendo.');
    return false;
  }
  if (edificio.cola.length >= 5) {
    if (!silencioso) aviso('La cola de entrenamiento está llena.');
    return false;
  }
  const costo = COSTO[tipo];
  if (!costo) return false;
  if (calcularPoblacion() + costo.poblacion > partida.tope) {
    if (!silencioso) aviso('Población al límite.');
    return false;
  }
  if (!pagar(costo)) {
    if (!silencioso) aviso(faltaRecurso(costo) || 'Falta oro');
    return false;
  }
  edificio.cola.push({ tipo, restante: costo.tiempo, total: costo.tiempo });
  return true;
}

function entrenarVarios(edificio, tipo, cantidad) {
  if (!edificio || edificio.muerto) return;
  if (!edificio.completo) {
    aviso('El edificio aún se está construyendo.');
    return;
  }
  let hechos = 0;
  let motivo = '';
  const costo = COSTO[tipo];
  for (let i = 0; i < cantidad; i++) {
    if (entrenar(edificio, tipo, true)) {
      hechos += 1;
      continue;
    }
    if (!costo) break;
    if (edificio.cola.length >= 5) motivo = 'La cola de entrenamiento está llena.';
    else if (calcularPoblacion() + costo.poblacion > partida.tope) motivo = 'Población al límite.';
    else motivo = faltaRecurso(costo) || 'Falta oro';
    break;
  }
  if (hechos < cantidad && motivo) aviso(motivo);
}

function esMilitar(u) {
  return u && u.esUnidad && u.equipo === 'patriota' && u.tipo !== 'aldeano' && !u.muerto;
}

function seleccionarEjercito() {
  const ids = [];
  for (const u of partida.unidades) if (esMilitar(u)) ids.push(u.id);
  partida.seleccion = ids;
  if (partida.modo === 'colocar') partida.modo = 'normal';
  if (!ids.length) aviso('No hay tropas. Entrena en el cuartel.');
  refrescarInterfaz();
}

function aldeanosOciosos() {
  const ids = [];
  for (const u of partida.unidades) {
    if (!u.muerto && u.equipo === 'patriota' && u.tipo === 'aldeano' && u.estado === 'quieto') ids.push(u.id);
  }
  return ids;
}

let ociosoCursor = 0;

function seleccionarUnOcioso() {
  const ids = aldeanosOciosos();
  if (!ids.length) {
    aviso('No hay aldeanos ociosos.');
    refrescarInterfaz();
    return;
  }
  ociosoCursor = (ociosoCursor + 1) % ids.length;
  partida.seleccion = [ids[ociosoCursor]];
  if (partida.modo === 'colocar') partida.modo = 'normal';
  refrescarInterfaz();
}

function seleccionarOciosos() {
  const ids = [];
  for (const u of partida.unidades) {
    if (!u.muerto && u.equipo === 'patriota' && u.tipo === 'aldeano' && u.estado === 'quieto') ids.push(u.id);
  }
  if (!ids.length) {
    aviso('No hay aldeanos ociosos.');
    return;
  }
  partida.seleccion = ids;
  if (partida.modo === 'colocar') partida.modo = 'normal';
  refrescarInterfaz();
}

function reiniciar() {
  gesto = null;
  punteros.clear();
  crearPartida({ demo: false, auto: false });
  dibujar();
  refrescarInterfaz();
}

function unidadesPropiasSeleccionadas() {
  const lista = [];
  for (const id of partida.seleccion) {
    const e = porId(id);
    if (e && e.esUnidad && e.equipo === 'patriota' && !e.muerto) lista.push(e);
  }
  return lista;
}

function ordenarRegreso(aldeanos) {
  for (const u of aldeanos) {
    u.estado = 'entregar';
    u.objetivoId = null;
    u.destino = null;
    u.asaltoId = null;
  }
}

function toleranciaNodo(n) {
  if (n.variante === 'bosque') return n.radio + 64;
  if (n.variante === 'mina') return n.radio + 40;
  return n.radio + 22;
}

function nodoBajoOrden(x, y) {
  let mejor = null;
  let mejorD = Infinity;
  for (const n of partida.nodos) {
    if (n.cantidad <= 0) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= toleranciaNodo(n) && d < mejorD) {
      mejorD = d;
      mejor = n;
    }
  }
  return mejor;
}

function emitirOrden(unidades, hit, w) {
  if (!unidades.length) return;
  const aldeanos = unidades.filter((u) => u.tipo === 'aldeano');
  const resto = unidades.filter((u) => u.tipo !== 'aldeano');
  let nodo = hit && hit.clase === 'nodo' ? hit : null;
  if (!nodo && aldeanos.length) nodo = nodoBajoOrden(w.x, w.y);
  if (nodo) {
    if (aldeanos.length) ordenarRecoleccion(aldeanos, nodo);
    if (resto.length) ordenarMovimiento(resto, nodo.x, nodo.y);
    return;
  }
  if (hit && hit.equipo && hit.equipo !== 'patriota') {
    ordenarAtaque(unidades, hit);
    return;
  }
  if (hit && hit.tipo === 'centro' && hit.equipo === 'patriota' && aldeanos.length) {
    ordenarRegreso(aldeanos);
    if (resto.length) ordenarMovimiento(resto, w.x, w.y);
    return;
  }
  ordenarMovimiento(unidades, w.x, w.y);
}

function marcoVisual(b) {
  if (b.tipo === 'centro') return { ox: 2, oy: -16, ancho: 116, alto: 84 };
  if (b.tipo === 'cuartel') return { ox: 2, oy: -10, ancho: 144, alto: 70 };
  return { ox: 0, oy: 0, ancho: b.ancho, alto: b.alto };
}

function buscarEn(wx, wy) {
  const slop = 12 / cam.zoom;
  for (let i = partida.unidades.length - 1; i >= 0; i--) {
    const u = partida.unidades[i];
    if (u.muerto) continue;
    if (Math.hypot(u.x - wx, u.y - wy) <= u.radio + slop) return u;
  }
  for (let i = partida.edificios.length - 1; i >= 0; i--) {
    const b = partida.edificios[i];
    if (b.muerto || b.hp <= 0) continue;
    const m = marcoVisual(b);
    if (Math.abs(b.x + m.ox - wx) <= m.ancho / 2 + slop && Math.abs(b.y + m.oy - wy) <= m.alto / 2 + slop) return b;
  }
  for (const n of partida.nodos) {
    if (n.cantidad <= 0) continue;
    if (Math.hypot(n.x - wx, n.y - wy) <= toleranciaNodo(n) + slop) return n;
  }
  return null;
}

function alternarSeleccion(id) {
  const i = partida.seleccion.indexOf(id);
  if (i >= 0) partida.seleccion.splice(i, 1);
  else partida.seleccion.push(id);
}

function teclaCamara(tecla) {
  const k = tecla.length === 1 ? tecla.toLowerCase() : tecla;
  if (k === 'a' || k === 'ArrowLeft') return [-1, 0];
  if (k === 'd' || k === 'ArrowRight') return [1, 0];
  if (k === 'w' || k === 'ArrowUp') return [0, -1];
  if (k === 's' || k === 'ArrowDown') return [0, 1];
  return null;
}

function seleccionarConRaton(hit, shift) {
  if (!hit) {
    if (!shift) partida.seleccion = [];
    return;
  }
  if (shift) {
    if (partida.seleccion.indexOf(hit.id) < 0) partida.seleccion.push(hit.id);
    return;
  }
  partida.seleccion = [hit.id];
}

function manejarToque(sx, sy, soloOrden, shift, pointerType) {
  if (partida.fase !== 'jugando') return;
  const w = pantallaAMundo(sx, sy);
  if (partida.modo === 'colocar') {
    if (soloOrden) cancelarColocacion();
    else intentarColocar(w.x, w.y);
    return;
  }
  const hit = buscarEn(w.x, w.y);
  const esRaton = pointerType === 'mouse';
  if (!soloOrden && esRaton) {
    seleccionarConRaton(hit, shift);
    return;
  }
  const propios = unidadesPropiasSeleccionadas();
  if (soloOrden) {
    emitirOrden(propios, hit, w);
    return;
  }
  if (!hit) {
    if (propios.length) emitirOrden(propios, null, w);
    else partida.seleccion = [];
    return;
  }
  if (hit.clase === 'nodo') {
    if (propios.length) emitirOrden(propios, hit, w);
    else partida.seleccion = [hit.id];
    return;
  }
  if (hit.equipo === 'patriota') {
    if (shift) {
      alternarSeleccion(hit.id);
      return;
    }
    if (partida.seleccion.length === 1 && partida.seleccion[0] === hit.id) {
      partida.seleccion = [];
      return;
    }
    partida.seleccion = [hit.id];
    return;
  }
  if (propios.length) emitirOrden(propios, hit, w);
  else partida.seleccion = [hit.id];
}

function cajaTocaUnidad(caja, u) {
  const tam = tamanoSprite(u);
  const izquierda = u.x - tam * 0.34;
  const derecha = u.x + tam * 0.34;
  const arriba = u.y - tam * (1 - PIVOTE.desdeAbajo);
  const abajo = u.y + 6;
  return izquierda <= caja.derecha && derecha >= caja.izquierda && arriba <= caja.abajo && abajo >= caja.arriba;
}

function seleccionarCaja(x0, y0, x1, y1, shift) {
  if (partida.fase !== 'jugando' || partida.modo === 'colocar') return;
  const a = pantallaAMundo(x0, y0);
  const b = pantallaAMundo(x1, y1);
  const minx = Math.min(a.x, b.x);
  const maxx = Math.max(a.x, b.x);
  const miny = Math.min(a.y, b.y);
  const maxy = Math.max(a.y, b.y);
  const ids = [];
  const caja = { izquierda: minx, derecha: maxx, arriba: miny, abajo: maxy };
  for (const u of partida.unidades) {
    if (u.muerto || u.equipo !== 'patriota') continue;
    if (cajaTocaUnidad(caja, u)) ids.push(u.id);
  }
  if (shift) {
    const conjunto = new Set(partida.seleccion.concat(ids));
    partida.seleccion = Array.from(conjunto);
  } else partida.seleccion = ids;
}

function coordsEvento(e) {
  const r = lienzo.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function enBorde(x, y, margen) {
  return x < margen || y < margen || x > vista.w - margen || y > vista.h - margen;
}

function vectorBorde(x, y, margen) {
  let dx = 0;
  let dy = 0;
  if (x < margen) dx = -1;
  else if (x > vista.w - margen) dx = 1;
  if (y < margen) dy = -1;
  else if (y > vista.h - margen) dy = 1;
  return { x: dx, y: dy };
}

function sobreControl(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  return !!el.closest('button, #minimapa, #fin, #giro');
}

function zoomHacia(factor, sx, sy) {
  const antes = pantallaAMundo(sx, sy);
  cam.zoom = clamp(cam.zoom * factor, zoomMinimo(), ZOOM_MAX);
  cam.x = antes.x - (sx - vista.w / 2) / cam.zoom;
  cam.y = antes.y - (sy - vista.h / 2) / cam.zoom;
  clampCamara();
}

function alBajar(e) {
  if (e.button === 1) e.preventDefault();
  const p = coordsEvento(e);
  punteros.set(e.pointerId, { x: p.x, y: p.y, button: e.button });
  punteroMundo = pantallaAMundo(p.x, p.y);
  try { lienzo.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
  if (punteros.size >= 2) {
    const pts = Array.from(punteros.values());
    const a = pts[0];
    const b = pts[1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const mundo = pantallaAMundo(mx, my);
    gesto = {
      modo: 'pellizco',
      dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      zoom0: cam.zoom,
      wx: mundo.x,
      wy: mundo.y,
    };
    return;
  }
  if (e.pointerType === 'touch' || e.pointerType === 'pen') usaTacto = true;
  else if (e.pointerType === 'mouse' && window.matchMedia('(pointer: fine)').matches) usaTacto = false;
  const tactil = e.pointerType === 'touch';
  const modo = e.button === 1 ? 'arrastre'
    : e.button === 2 ? 'orden'
      : (tactil && enBorde(p.x, p.y, MARGEN_BORDE_TACTIL)) ? 'borde'
        : 'espera';
  gesto = {
    modo,
    x0: p.x,
    y0: p.y,
    x: p.x,
    y: p.y,
    camX: cam.x,
    camY: cam.y,
    shift: !!e.shiftKey,
    button: e.button,
    pointerType: e.pointerType || 'mouse',
  };
}

function alMover(e) {
  const p = coordsEvento(e);
  if (punteros.has(e.pointerId)) {
    const prev = punteros.get(e.pointerId);
    prev.x = p.x;
    prev.y = p.y;
  }
  if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
  punteroMundo = pantallaAMundo(p.x, p.y);
  if (!gesto) return;
  if (gesto.modo === 'pellizco' && punteros.size >= 2) {
    const pts = Array.from(punteros.values());
    const a = pts[0];
    const b = pts[1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    cam.zoom = clamp(gesto.zoom0 * (dist / gesto.dist0), zoomMinimo(), ZOOM_MAX);
    cam.x = gesto.wx - (mx - vista.w / 2) / cam.zoom;
    cam.y = gesto.wy - (my - vista.h / 2) / cam.zoom;
    clampCamara();
    return;
  }
  if (gesto.modo === 'consumido') return;
  gesto.x = p.x;
  gesto.y = p.y;
  if (gesto.modo === 'arrastre') {
    cam.x = gesto.camX - (p.x - gesto.x0) / cam.zoom;
    cam.y = gesto.camY - (p.y - gesto.y0) / cam.zoom;
    clampCamara();
    return;
  }
  if (gesto.modo === 'espera' && Math.hypot(p.x - gesto.x0, p.y - gesto.y0) > 12) gesto.modo = 'caja';
}

function alSubir(e) {
  punteros.delete(e.pointerId);
  if (!gesto) return;
  if (gesto.modo === 'pellizco') {
    if (punteros.size >= 2) return;
    gesto = punteros.size === 0 ? null : { modo: 'consumido' };
    return;
  }
  if (punteros.size > 0) return;
  const g = gesto;
  gesto = null;
  if (g.modo === 'espera') manejarToque(g.x0, g.y0, false, g.shift, g.pointerType);
  else if (g.modo === 'orden') manejarToque(g.x, g.y, true, false, g.pointerType);
  else if (g.modo === 'caja') seleccionarCaja(g.x0, g.y0, g.x, g.y, g.shift);
  refrescarInterfaz();
}

function alRueda(e) {
  e.preventDefault();
  const p = coordsEvento(e);
  if (e.ctrlKey || e.metaKey) {
    const factor = clamp(Math.exp(-e.deltaY * 0.012), 0.82, 1.22);
    zoomHacia(factor, p.x, p.y);
    return;
  }
  const decimal = !Number.isInteger(e.deltaX) || !Number.isInteger(e.deltaY);
  const desplazar = Math.abs(e.deltaX) > Math.abs(e.deltaY) || (decimal && Math.abs(e.deltaY) < 50);
  if (desplazar && (e.deltaX || e.deltaY)) {
    cam.x += e.deltaX / cam.zoom;
    cam.y += e.deltaY / cam.zoom;
    clampCamara();
    return;
  }
  if (!e.deltaY) return;
  zoomHacia(e.deltaY < 0 ? 1.08 : 0.92, p.x, p.y);
}

function alTeclaBajar(e) {
  if (e.target && e.target.closest && e.target.closest('input, textarea, button')) {
    if (e.key !== 'Escape') return;
  }
  if (teclaCamara(e.key)) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
  }
  if (!e.repeat && (e.key === 'q' || e.key === 'Q' || e.key === ',')) {
    e.preventDefault();
    seleccionarEjercito();
  }
  if (!e.repeat && e.key === '.') {
    e.preventDefault();
    seleccionarOciosos();
  }
  if (e.key === 'Escape') cancelarColocacion();
  teclas.add(e.key);
}

function alTeclaSubir(e) {
  teclas.delete(e.key);
}

function moverCamaraPorMinimapa(e) {
  const r = minimapa.getBoundingClientRect();
  const nx = clamp((e.clientX - r.left) / r.width, 0, 1);
  const ny = clamp((e.clientY - r.top) / r.height, 0, 1);
  cam.x = nx * MUNDO.w;
  cam.y = ny * MUNDO.h;
  clampCamara();
}

function registrarEntrada() {
  lienzo.addEventListener('pointerdown', alBajar);
  lienzo.addEventListener('pointermove', alMover);
  lienzo.addEventListener('pointerup', alSubir);
  lienzo.addEventListener('pointercancel', alSubir);
  const escenario = document.getElementById('escenario');
  const bloquearMenu = (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    e.preventDefault();
  };
  lienzo.addEventListener('contextmenu', bloquearMenu);
  escenario.addEventListener('contextmenu', bloquearMenu);
  lienzo.addEventListener('auxclick', (e) => e.preventDefault());
  escenario.addEventListener('wheel', alRueda, { passive: false });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('keydown', alTeclaBajar);
  window.addEventListener('keyup', alTeclaSubir);
  window.addEventListener('blur', () => teclas.clear());
  let miniActivo = false;
  minimapa.addEventListener('pointerdown', (e) => {
    miniActivo = true;
    try { minimapa.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    moverCamaraPorMinimapa(e);
    e.preventDefault();
  });
  minimapa.addEventListener('pointermove', (e) => {
    if (miniActivo) moverCamaraPorMinimapa(e);
  });
  minimapa.addEventListener('pointerup', () => { miniActivo = false; });
  minimapa.addEventListener('pointercancel', () => { miniActivo = false; });
  const quitarFoco = () => {
    const activo = document.activeElement;
    if (activo && activo.tagName === 'BUTTON' && typeof activo.blur === 'function') activo.blur();
  };
  escenario.addEventListener('pointerup', quitarFoco);
  escenario.addEventListener('click', quitarFoco);
  document.getElementById('btn-ejercito').addEventListener('click', seleccionarEjercito);
  document.getElementById('btn-ociosos').addEventListener('click', seleccionarUnOcioso);
  document.getElementById('btn-cerrar-pista').addEventListener('click', () => {
    document.getElementById('pista').classList.add('oculta');
  });
  document.getElementById('btn-reiniciar').addEventListener('click', reiniciar);
  document.getElementById('btn-de-nuevo').addEventListener('click', reiniciar);
  document.getElementById('btn-seguir').addEventListener('click', () => {
    document.getElementById('giro').classList.add('oculto');
  });
  elComandos.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.accion === 'cancelar') cancelarColocacion();
    else if (btn.dataset.accion === 'cuartel') empezarColocacion('cuartel');
    else if (btn.dataset.accion === 'casa') empezarColocacion('casa');
    else if (btn.dataset.accion === 'entrenar') {
      const ed = edificioPropioUnico(seleccionEntidades());
      if (ed) entrenarVarios(ed, btn.dataset.tipo, e.shiftKey ? 5 : 1);
    }
    refrescarInterfaz();
  });
}

function seleccionEntidades() {
  const lista = [];
  for (const id of partida.seleccion) {
    const e = porId(id);
    if (e && !e.muerto && (e.clase !== 'nodo' || e.cantidad > 0)) lista.push(e);
  }
  return lista;
}

function edificioPropioUnico(ents) {
  let edificio = null;
  for (const e of ents) {
    if (e.esUnidad) return null;
    if (e.esEdificio && e.equipo === 'patriota') edificio = e;
  }
  return edificio;
}

function nombreTipo(tipo) {
  if (tipo === 'aldeano') return 'Aldeano';
  if (tipo === 'fusilero') return 'Fusilero patriota';
  if (tipo === 'lancero') return 'Lancero llanero';
  return 'Unidad';
}

function nombreDe(e) {
  if (e.clase === 'nodo') {
    if (e.variante === 'huerta') return 'Huerta';
    if (e.variante === 'arbusto') return 'Arbusto';
    if (e.variante === 'bosque') return 'Bosque';
    return 'Mina de oro';
  }
  if (e.tipo === 'centro') return e.equipo === 'patriota' ? 'Centro urbano' : 'Centro urbano realista';
  if (e.tipo === 'cuartel') return e.equipo === 'patriota' ? 'Cuartel' : 'Cuartel realista';
  if (e.tipo === 'casa') return e.equipo === 'patriota' ? 'Casa' : 'Casa realista';
  if (e.tipo === 'aldeano') return e.equipo === 'patriota' ? 'Aldeano' : 'Aldeano realista';
  if (e.tipo === 'fusilero') return 'Fusilero patriota';
  if (e.tipo === 'lancero') return 'Lancero llanero';
  if (e.tipo === 'fusilero_realista') return 'Fusilero realista';
  if (e.tipo === 'dragon') return 'Dragón realista';
  return 'Unidad';
}

function detalleDe(e) {
  if (e.clase === 'nodo') {
    const nombre = e.tipo === 'comida' ? 'comida' : e.tipo === 'madera' ? 'madera' : 'oro';
    return Math.ceil(e.cantidad) + ' ' + nombre;
  }
  let texto = 'Vida ' + Math.max(0, Math.ceil(e.hp)) + '/' + e.hpMax;
  if (e.esUnidad && e.carga > 0) texto += ' · Lleva ' + e.carga + ' ' + e.cargaTipo;
  if (e.esEdificio && !e.completo) texto += ' · Obra ' + Math.floor(e.obra * 100) + '%';
  if (e.esEdificio && e.cola && e.cola.length) texto += ' · Cola ' + e.cola.length;
  return texto;
}

function textoCosto(c) {
  const partes = [];
  if (c.comida) partes.push(c.comida + ' comida');
  if (c.madera) partes.push(c.madera + ' madera');
  if (c.oro) partes.push(c.oro + ' oro');
  return partes.join(' · ');
}

function htmlBotonEntrenar(tipo) {
  const costo = COSTO[tipo];
  const clase = puedeEntrenarTipo(tipo) ? '' : 'insuficiente';
  return '<button type="button" data-accion="entrenar" data-tipo="' + tipo + '" class="' + clase + '">' +
    '<span class="btn-titulo">' + nombreTipo(tipo) + '</span>' +
    '<span class="btn-costo">' + textoCosto(costo) + '</span></button>';
}

function firmaComandos() {
  if (partida.modo === 'colocar') return 'colocar-' + (partida.construir || 'cuartel');
  const ents = seleccionEntidades();
  const ed = edificioPropioUnico(ents);
  let firma = ents.map((e) => e.id + (e.completo === false ? 'o' : 'c')).join(',');
  if (ed) firma += '>' + ed.cola.map((i) => i.tipo).join('.') + (ed.completo ? '' : ':obra');
  return firma;
}

function renderComandos() {
  const ents = seleccionEntidades();
  const ed = edificioPropioUnico(ents);
  let hayAldeanos = false;
  for (const e of ents) if (e.tipo === 'aldeano' && e.equipo === 'patriota') hayAldeanos = true;
  let html = '';
  if (partida.modo === 'colocar') {
    html = '<button type="button" class="secundario" data-accion="cancelar">Cancelar</button>';
  } else if (ed && !ed.completo) {
    html = '<p class="nota-obra">En construcción ' + Math.floor(ed.obra * 100) + '%</p>';
  } else if (ed && ed.tipo === 'centro') {
    html = htmlBotonEntrenar('aldeano');
  } else if (ed && ed.tipo === 'cuartel') {
    html = htmlBotonEntrenar('fusilero') + htmlBotonEntrenar('lancero');
  } else if (hayAldeanos) {
    const claseCuartel = puedePagar(COSTO.cuartel) ? '' : 'insuficiente';
    const claseCasa = puedePagar(COSTO.casa) ? '' : 'insuficiente';
    html = '<button type="button" data-accion="cuartel" class="' + claseCuartel + '">' +
      '<span class="btn-titulo">Construir cuartel</span>' +
      '<span class="btn-costo">' + textoCosto(COSTO.cuartel) + '</span></button>' +
      '<button type="button" data-accion="casa" class="' + claseCasa + '">' +
      '<span class="btn-titulo">Construir casa</span>' +
      '<span class="btn-costo">' + textoCosto(COSTO.casa) + ' · +5 población</span></button>';
  }
  if (ed && ed.completo && ed.cola.length) {
    html += '<div class="cola"><span class="cola-texto"></span><div class="progreso"><span></span></div></div>';
  }
  elComandos.innerHTML = html;
}

function refrescarProgreso() {
  const ed = edificioPropioUnico(seleccionEntidades());
  elComandos.querySelectorAll('[data-tipo]').forEach((btn) => {
    btn.classList.toggle('insuficiente', !puedeEntrenarTipo(btn.dataset.tipo));
  });
  const cuartelBtn = elComandos.querySelector('[data-accion="cuartel"]');
  if (cuartelBtn) cuartelBtn.classList.toggle('insuficiente', !puedePagar(COSTO.cuartel));
  const casaBtn = elComandos.querySelector('[data-accion="casa"]');
  if (casaBtn) casaBtn.classList.toggle('insuficiente', !puedePagar(COSTO.casa));
  const nota = elComandos.querySelector('.nota-obra');
  if (nota && ed) nota.textContent = 'En construcción ' + Math.floor((ed.obra || 0) * 100) + '%';
  if (ed && ed.cola && ed.cola[0]) {
    const item = ed.cola[0];
    const barra = elComandos.querySelector('.progreso > span');
    const colaTxt = elComandos.querySelector('.cola-texto');
    if (barra) barra.style.width = ((1 - item.restante / item.total) * 100) + '%';
    if (colaTxt) {
      colaTxt.textContent = 'Entrenando ' + nombreTipo(item.tipo) + (ed.cola.length > 1 ? ' · cola ' + ed.cola.length : '');
    }
  }
}

function refrescarFicha() {
  const ents = seleccionEntidades();
  if (!ents.length) {
    elFichaNombre.textContent = 'Sin selección';
    elFichaDetalle.textContent = 'Clic o toque para seleccionar. Arrastra un recuadro.';
    return;
  }
  if (ents.length === 1) {
    elFichaNombre.textContent = nombreDe(ents[0]);
    elFichaDetalle.textContent = detalleDe(ents[0]);
    return;
  }
  let vida = 0;
  let aldeanos = 0;
  let soldados = 0;
  for (const e of ents) {
    vida += e.hp || 0;
    if (e.tipo === 'aldeano') aldeanos += 1;
    else if (e.esUnidad) soldados += 1;
  }
  if (aldeanos && !soldados) elFichaNombre.textContent = aldeanos + (aldeanos === 1 ? ' aldeano' : ' aldeanos');
  else if (soldados && !aldeanos) elFichaNombre.textContent = soldados + (soldados === 1 ? ' soldado' : ' soldados');
  else elFichaNombre.textContent = ents.length + ' unidades';
  elFichaDetalle.textContent = 'Vida total ' + Math.ceil(vida);
}

function prefiereTacto() {
  return usaTacto;
}

function textoPista() {
  const tacto = prefiereTacto();
  if (partida.fase === 'victoria' || (partida.fase === 'resolviendo' && partida.resultado === 'victoria')) {
    return 'La fuerza realista se rinde.';
  }
  if (partida.fase === 'derrota' || (partida.fase === 'resolviendo' && partida.resultado === 'derrota')) {
    return 'Tu centro urbano ha caído.';
  }
  if (partida.modo === 'colocar') {
    const obra = partida.construir === 'casa' ? 'la casa' : 'el cuartel';
    return tacto
      ? 'Toca el terreno para colocar ' + obra + '.'
      : 'Clic en el terreno para colocar ' + obra + '. Escape cancela.';
  }
  const ents = seleccionEntidades();
  let aldeano = false;
  let soldado = false;
  let edificio = false;
  for (const e of ents) {
    if (e.tipo === 'aldeano' && e.equipo === 'patriota') aldeano = true;
    else if (e.esUnidad && e.equipo === 'patriota') soldado = true;
    else if (e.esEdificio && e.equipo === 'patriota') edificio = true;
  }
  if (aldeano) {
    return tacto
      ? 'Toca un recurso para recolectar, un enemigo para atacar o tu centro para volver.'
      : 'Clic derecho: recolectar, atacar o volver al centro.';
  }
  if (soldado) {
    return tacto
      ? 'Toca el terreno para mover o un enemigo para atacar.'
      : 'Clic derecho: mover o atacar.';
  }
  if (edificio) return 'Entrena fusileros y lanceros. Salen frente al edificio.';
  return tacto
    ? 'Toca para seleccionar. Toca el terreno para mover.'
    : 'Clic izquierdo selecciona. Mayús suma. Clic derecho mueve. Coma o Q: ejército.';
}

function textoReloj(segundos) {
  const total = Math.max(0, Math.floor(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return String(minutos).padStart(2, '0') + ':' + String(resto).padStart(2, '0');
}

function aviso(texto) {
  elAviso.textContent = texto;
  elAviso.classList.add('visible');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => elAviso.classList.remove('visible'), 2400);
}

function refrescarInterfaz() {
  const comida = Math.floor(partida.comida);
  const madera = Math.floor(partida.madera);
  const oro = Math.floor(partida.oro);
  if (comida !== cache.comida) {
    elComida.textContent = String(comida);
    cache.comida = comida;
  }
  if (madera !== cache.madera) {
    elMadera.textContent = String(madera);
    cache.madera = madera;
  }
  if (oro !== cache.oro) {
    elOro.textContent = String(oro);
    cache.oro = oro;
  }
  const pob = calcularPoblacion() + '/' + partida.tope;
  if (pob !== cache.pob) {
    elPoblacion.textContent = pob;
    cache.pob = pob;
  }
  const reloj = textoReloj(partida.tiempo);
  elTiempo.textContent = reloj;
  cache.reloj = reloj;
  const ociosos = aldeanosOciosos().length;
  const elOciosos = document.getElementById('val-ociosos');
  const btnOciosos = document.getElementById('btn-ociosos');
  if (elOciosos) elOciosos.textContent = String(ociosos);
  if (btnOciosos) btnOciosos.classList.toggle('vacio', ociosos === 0);
  const firma = firmaComandos();
  if (firma !== cache.firma) {
    cache.firma = firma;
    renderComandos();
    document.body.classList.toggle('colocando', partida.modo === 'colocar');
  }
  refrescarProgreso();
  refrescarFicha();
  const pista = textoPista();
  if (pista !== cache.pista) {
    elPista.textContent = pista;
    cache.pista = pista;
  }
}

function contorno(g, ancho) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = ancho || 3;
  g.strokeStyle = '#1a120c';
  g.stroke();
}

const ARTE_UNIDAD = {
  aldeano_patriota: 'aldeano_patriota',
  aldeano_realista: 'aldeano_realista',
  fusilero: 'infanteria_gran_colombia',
  lancero: 'lancero_llanero',
  fusilero_realista: 'infanteria_realista',
  dragon: 'husares_fernando_vii',
};
const PIVOTE = { x: 0.5, desdeAbajo: 0.05 };
const arteUnidades = {};

function nombreArte(u) {
  if (u.tipo === 'aldeano') return u.equipo === 'patriota' ? 'aldeano_patriota' : 'aldeano_realista';
  return ARTE_UNIDAD[u.tipo] || 'infanteria_realista';
}

function tamanoSprite(u) {
  return (u.tipo === 'lancero' || u.tipo === 'dragon') ? 84 : 64;
}

function cargarArteUnidades() {
  Object.keys(ARTE_UNIDAD).forEach((clave) => {
    const nombre = ARTE_UNIDAD[clave];
    if (arteUnidades[nombre + '_r']) return;
    ['r', 'l'].forEach((lado) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = 'assets/units/' + nombre + '_idle_' + lado + '_256.png';
      arteUnidades[nombre + '_' + lado] = img;
    });
  });
}

function imagenUnidad(u) {
  const lado = u.frente < 0 ? 'l' : 'r';
  return arteUnidades[nombreArte(u) + '_' + lado] || null;
}

function generarSprites() {
  sprites.arbol0 = pintarArbol('#2f6b32', '#3f8a3c');
  sprites.arbol1 = pintarArbol('#24562c', '#2f7a38');
  sprites.arbol2 = pintarArbol('#3d6b28', '#6a8f32');
  sprites.arbusto = pintarArbusto();
  sprites.huerta = pintarHuerta();
  sprites.mina = pintarMina();
}

function lienzoSprite(w, h, pintar) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  pintar(g, w, h);
  return c;
}


function pintarArbol(oscuro, claro) {
  return lienzoSprite(64, 72, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath();
    g.ellipse(32, 64, 16, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6b4428';
    g.fillRect(28, 40, 8, 22);
    g.fillStyle = oscuro;
    g.beginPath();
    g.arc(32, 30, 18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = claro;
    g.beginPath();
    g.arc(24, 26, 10, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#173318';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(32, 30, 18, 0, Math.PI * 2);
    g.stroke();
  });
}

function pintarArbusto() {
  return lienzoSprite(64, 48, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.ellipse(32, 40, 18, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2f6b32';
    g.beginPath();
    g.arc(24, 28, 12, 0, Math.PI * 2);
    g.arc(40, 28, 12, 0, Math.PI * 2);
    g.arc(32, 20, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d84a4a';
    g.beginPath();
    g.arc(22, 26, 2.2, 0, Math.PI * 2);
    g.arc(34, 18, 2.2, 0, Math.PI * 2);
    g.arc(42, 30, 2.2, 0, Math.PI * 2);
    g.fill();
  });
}

function pintarHuerta() {
  return lienzoSprite(96, 64, (g) => {
    g.fillStyle = '#6b4428';
    g.fillRect(6, 10, 4, 44);
    g.fillRect(86, 10, 4, 44);
    g.fillRect(6, 10, 84, 4);
    g.fillRect(6, 50, 84, 4);
    g.fillStyle = '#c2a15a';
    g.fillRect(14, 18, 68, 28);
    g.fillStyle = '#3f8a3c';
    for (let i = 0; i < 4; i++) g.fillRect(18, 22 + i * 6, 60, 3);
    g.fillStyle = '#e2b33a';
    g.fillRect(48, 24, 16, 8);
  });
}

function pintarMina() {
  return lienzoSprite(72, 56, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath();
    g.ellipse(36, 48, 22, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8d8478';
    g.beginPath();
    g.moveTo(10, 44);
    g.lineTo(24, 18);
    g.lineTo(40, 44);
    g.fill();
    g.fillStyle = '#6e675e';
    g.beginPath();
    g.moveTo(28, 44);
    g.lineTo(48, 12);
    g.lineTo(66, 44);
    g.fill();
    g.fillStyle = '#e2b33a';
    g.fillRect(44, 28, 8, 5);
    g.fillRect(30, 34, 6, 4);
    contorno(g, 2);
  });
}

function generarTerreno() {
  const c = document.createElement('canvas');
  c.width = MUNDO.w;
  c.height = MUNDO.h;
  const g = c.getContext('2d');
  const aleatorio = rng(1810);
  g.fillStyle = '#7d9a48';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = aleatorio() < 0.5 ? 'rgba(198,168,84,0.3)' : 'rgba(55,96,40,0.28)';
    g.beginPath();
    g.ellipse(
      aleatorio() * c.width,
      aleatorio() * c.height,
      36 + aleatorio() * 120,
      20 + aleatorio() * 54,
      aleatorio() * 6,
      0,
      Math.PI * 2
    );
    g.fill();
  }
  g.fillStyle = 'rgba(214,186,120,0.38)';
  g.beginPath();
  g.ellipse(CAMP.patriota.x, CAMP.patriota.y, 170, 120, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(CAMP.realista.x, CAMP.realista.y, 160, 110, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(150,116,68,0.55)';
  g.lineWidth = 26;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(CAMP.patriota.x, CAMP.patriota.y);
  g.quadraticCurveTo(900, 980, 1140, 700);
  g.quadraticCurveTo(1500, 430, CAMP.realista.x, CAMP.realista.y);
  g.stroke();
  g.strokeStyle = 'rgba(58,122,146,0.82)';
  g.lineWidth = 24;
  g.beginPath();
  g.moveTo(0, 760);
  g.bezierCurveTo(420, 690, 760, 860, 1120, 780);
  g.bezierCurveTo(1540, 690, 1760, 830, MUNDO.w, 730);
  g.stroke();
  g.strokeStyle = 'rgba(190,230,234,0.35)';
  g.lineWidth = 5;
  g.stroke();
  for (let i = 0; i < 48; i++) {
    const x = aleatorio() * c.width;
    const y = aleatorio() * c.height;
    if (Math.hypot(x - CAMP.patriota.x, y - CAMP.patriota.y) < 230) continue;
    if (Math.hypot(x - CAMP.realista.x, y - CAMP.realista.y) < 220) continue;
    if (Math.hypot(x - 1140, y - 700) < 130) continue;
    const tipo = (aleatorio() * 3) | 0;
    const escala = 0.5 + aleatorio() * 0.45;
    const img = sprites['arbol' + tipo];
    const w = 54 * escala;
    g.drawImage(img, x - w / 2, y - w * 0.82, w, w);
  }
  terreno = c;
}

function dibujarBandera(x, y, equipo) {
  const onda = Math.sin(partida.tiempo * 5 + x) * 2;
  ctx.save();
  ctx.translate(x, y);
  if (equipo === 'patriota') {
    const colores = ['#f2c230', '#1f4e89', '#c0392b'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colores[i];
      ctx.beginPath();
      ctx.moveTo(0, i * 5);
      ctx.lineTo(18, i * 5 + onda);
      ctx.lineTo(18, i * 5 + 5 + onda);
      ctx.lineTo(0, i * 5 + 5);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, 18, 14);
    ctx.strokeStyle = '#9c2b2b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18, 14);
    ctx.moveTo(18, 0);
    ctx.lineTo(0, 14);
    ctx.stroke();
  }
  ctx.restore();
}

function dibujarAndamio(ancho, alto) {
  ctx.save();
  ctx.strokeStyle = '#c4924e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-ancho * 0.42, alto * 0.32);
  ctx.lineTo(-ancho * 0.42, -alto * 0.28);
  ctx.moveTo(ancho * 0.42, alto * 0.32);
  ctx.lineTo(ancho * 0.42, -alto * 0.16);
  ctx.moveTo(-ancho * 0.42, 0);
  ctx.lineTo(ancho * 0.42, 0);
  ctx.stroke();
  ctx.restore();
}

function dibujarCentro(b) {
  const obra = b.completo ? 1 : Math.max(0.05, b.obra);
  const alto = 34 * obra;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 24, b.ancho * 0.42, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  const marco = marcoVisual(b);
  ctx.fillStyle = b.equipo === 'patriota' ? 'rgba(31,78,137,0.22)' : 'rgba(156,43,43,0.22)';
  ctx.fillRect(marco.ox - marco.ancho / 2, marco.oy - marco.alto / 2, marco.ancho, marco.alto);
  ctx.fillStyle = '#efe6d2';
  ctx.fillRect(-40, 16 - alto, 80, alto);
  ctx.strokeStyle = '#2a2118';
  ctx.lineWidth = 2;
  ctx.strokeRect(-40, 16 - alto, 80, alto);
  if (obra > 0.4) {
    ctx.fillStyle = '#6e4630';
    ctx.fillRect(-9, 16 - 20, 18, 20);
    ctx.fillStyle = '#b7dbe6';
    ctx.fillRect(-30, 18 - alto, 12, 10);
    ctx.fillRect(18, 18 - alto, 12, 10);
    ctx.strokeRect(-30, 18 - alto, 12, 10);
    ctx.strokeRect(18, 18 - alto, 12, 10);
  }
  if (obra > 0.25) {
    ctx.fillStyle = b.equipo === 'patriota' ? '#a33b2b' : '#7a1c1c';
    ctx.beginPath();
    ctx.moveTo(-50, 18 - alto);
    ctx.lineTo(0, -6 - alto);
    ctx.lineTo(50, 18 - alto);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#3a2a1c';
  ctx.beginPath();
  ctx.moveTo(36, 16);
  ctx.lineTo(36, -10 - alto);
  ctx.stroke();
  dibujarBandera(36, -10 - alto, b.equipo);
  if (!b.completo) dibujarAndamio(b.ancho, b.alto);
  if (b.golpe > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-40, 16 - alto, 80, alto);
  }
  ctx.restore();
}

function dibujarCasa(b) {
  const obra = b.completo ? 1 : Math.max(0.05, b.obra || 0);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const alto = 22 * obra;
  ctx.fillStyle = '#efe2c4';
  ctx.fillRect(-22, 12 - alto, 44, alto);
  ctx.strokeStyle = '#2a2118';
  ctx.lineWidth = 2;
  ctx.strokeRect(-22, 12 - alto, 44, alto);
  if (obra > 0.35) {
    ctx.fillStyle = '#8d3a2e';
    ctx.beginPath();
    ctx.moveTo(-26, 14 - alto);
    ctx.lineTo(0, -2 - alto);
    ctx.lineTo(26, 14 - alto);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6e4630';
    ctx.fillRect(-5, 12 - 12, 10, 12);
  }
  if (!b.completo) dibujarAndamio(b.ancho || 64, b.alto || 56);
  ctx.restore();
}

function dibujarCuartel(b) {
  const obra = b.completo ? 1 : Math.max(0.05, b.obra);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 22, b.ancho * 0.42, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  const alto = 28 * obra;
  ctx.fillStyle = '#e7d7b4';
  ctx.fillRect(-58, 14 - alto, 116, alto);
  ctx.strokeStyle = '#2a2118';
  ctx.lineWidth = 2;
  ctx.strokeRect(-58, 14 - alto, 116, alto);
  if (obra > 0.35) {
    ctx.fillStyle = b.equipo === 'patriota' ? '#1f4e89' : '#8d1f1f';
    ctx.fillRect(-10, 14 - 16, 20, 16);
    ctx.fillStyle = '#9ecfdf';
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      ctx.fillRect(i * 22 - 6, 16 - alto, 12, 8);
    }
  }
  if (obra > 0.2) {
    ctx.fillStyle = '#8d3a2e';
    ctx.beginPath();
    ctx.moveTo(-66, 16 - alto);
    ctx.lineTo(0, -2 - alto);
    ctx.lineTo(66, 16 - alto);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#3a2a1c';
  ctx.beginPath();
  ctx.moveTo(52, 12);
  ctx.lineTo(52, -8 - alto);
  ctx.stroke();
  dibujarBandera(52, -8 - alto, b.equipo);
  if (!b.completo) dibujarAndamio(b.ancho, b.alto);
  if (b.golpe > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(-58, 14 - alto, 116, alto);
  }
  ctx.restore();
}

function dibujarNodo(n) {
  if (!enVista(n.x, n.y, 90)) return;
  const resta = Math.max(0.15, n.cantidad / n.cantidadMax);
  if (n.variante === 'bosque') {
    const visibles = Math.max(1, Math.ceil(n.arboles.length * (n.cantidad / n.cantidadMax)));
    for (let i = 0; i < visibles; i++) {
      const a = n.arboles[i];
      const img = sprites['arbol' + a.tipo];
      const w = 50 * a.escala;
      ctx.drawImage(img, n.x + a.ox - w / 2, n.y + a.oy - w * 0.8, w, w);
    }
  } else if (n.variante === 'huerta') {
    const w = 84 * (0.8 + 0.2 * resta);
    ctx.drawImage(sprites.huerta, n.x - w / 2, n.y - w * 0.38, w, w * 0.68);
  } else if (n.variante === 'mina') {
    ctx.drawImage(sprites.mina, n.x - 32, n.y - 30, 64, 50);
  } else {
    const w = 48 * (0.72 + 0.28 * resta);
    ctx.drawImage(sprites.arbusto, n.x - w / 2, n.y - w * 0.62, w, w * 0.75);
  }
  if (partida.seleccion.indexOf(n.id) >= 0) {
    ctx.strokeStyle = '#fff4cc';
    ctx.lineWidth = 2 / cam.zoom;
    ctx.beginPath();
    ctx.ellipse(n.x, n.y, n.radio, n.radio * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function dibujarUnidad(u) {
  if (!enVista(u.x, u.y, 70)) return;
  const seleccionado = partida.seleccion.indexOf(u.id) >= 0;
  ctx.fillStyle = u.equipo === 'patriota' ? 'rgba(31,78,137,0.28)' : 'rgba(156,43,43,0.28)';
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + 2, u.radio * 1.05, u.radio * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  if (seleccionado) {
    const pulso = 1 + Math.sin(partida.tiempo * 6 + u.id) * 0.06;
    ctx.strokeStyle = u.equipo === 'patriota' ? '#ffe08a' : '#ffb4b4';
    ctx.lineWidth = 2 / cam.zoom;
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + 2, (u.radio + 5) * pulso, u.radio * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const img = imagenUnidad(u);
  if (img && img.complete && img.naturalWidth) {
    const tam = tamanoSprite(u);
    const izquierda = u.x - tam * PIVOTE.x;
    const arriba = u.y - tam * (1 - PIVOTE.desdeAbajo);
    ctx.drawImage(img, izquierda, arriba, tam, tam);
  }
  if (u.golpe > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(u.x, u.y - 8, u.radio * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
}

function dibujarBarra(x, y, ancho, hp, hpMax) {
  const t = clamp(hp / hpMax, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - ancho / 2, y, ancho, 4);
  ctx.fillStyle = t > 0.55 ? '#3d9a45' : t > 0.28 ? '#e2b33a' : '#c4382b';
  ctx.fillRect(x - ancho / 2, y, Math.max(0, ancho * t), 4);
}

function dibujarRotulo(texto, x, y) {
  ctx.save();
  ctx.font = '700 ' + (15 / cam.zoom) + 'px Palatino, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ancho = ctx.measureText(texto).width + 12;
  const alto = 20 / cam.zoom;
  ctx.fillStyle = 'rgba(28,20,12,0.72)';
  ctx.fillRect(x - ancho / 2, y - alto / 2, ancho, alto);
  ctx.fillStyle = '#f6edd8';
  ctx.fillText(texto, x, y);
  ctx.restore();
}

function dibujarMinimapa() {
  const w = mini.w;
  const h = mini.h;
  mctx.setTransform(vista.dpr, 0, 0, vista.dpr, 0, 0);
  mctx.fillStyle = '#7d9a48';
  mctx.fillRect(0, 0, w, h);
  mctx.strokeStyle = 'rgba(58,122,146,0.95)';
  mctx.lineWidth = 2;
  mctx.beginPath();
  mctx.moveTo(0, h * 0.56);
  mctx.bezierCurveTo(w * 0.25, h * 0.48, w * 0.55, h * 0.66, w, h * 0.5);
  mctx.stroke();
  const sx = w / MUNDO.w;
  const sy = h / MUNDO.h;
  for (const n of partida.nodos) {
    if (n.cantidad <= 0) continue;
    mctx.fillStyle = n.tipo === 'comida' ? '#d7ec9a' : n.tipo === 'madera' ? '#5c3a22' : '#e2b33a';
    mctx.fillRect(n.x * sx - 1.5, n.y * sy - 1.5, 3, 3);
  }
  for (const b of partida.edificios) {
    if (b.muerto || b.hp <= 0) continue;
    mctx.fillStyle = b.equipo === 'patriota' ? '#d6e4f7' : '#f0b0b0';
    const bw = Math.max(4, b.ancho * sx);
    const bh = Math.max(3, b.alto * sy);
    mctx.fillRect(b.x * sx - bw / 2, b.y * sy - bh / 2, bw, bh);
  }
  for (const u of partida.unidades) {
    if (u.muerto) continue;
    const marcha = u.equipo === 'realista' && u.estado === 'asalto';
    if (marcha) {
      mctx.fillStyle = '#1a120c';
      mctx.fillRect(u.x * sx - 3.2, u.y * sy - 3.2, 6.4, 6.4);
      mctx.fillStyle = '#ffe08a';
      mctx.fillRect(u.x * sx - 2.2, u.y * sy - 2.2, 4.4, 4.4);
    } else {
      mctx.fillStyle = u.equipo === 'patriota' ? '#1f4e89' : '#7d1a1a';
      mctx.fillRect(u.x * sx - 1, u.y * sy - 1, 2.2, 2.2);
    }
  }
  const vx = vista.w / cam.zoom;
  const vy = vista.h / cam.zoom;
  mctx.strokeStyle = '#fff8e8';
  mctx.lineWidth = 1;
  mctx.strokeRect((cam.x - vx / 2) * sx, (cam.y - vy / 2) * sy, vx * sx, vy * sy);
}

function dibujar() {
  ctx.setTransform(vista.dpr, 0, 0, vista.dpr, 0, 0);
  ctx.fillStyle = '#7d9a48';
  ctx.fillRect(0, 0, vista.w, vista.h);
  ctx.save();
  ctx.translate(vista.w / 2, vista.h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  if (terreno) ctx.drawImage(terreno, 0, 0);
  for (const n of partida.nodos) dibujarNodo(n);
  for (const m of partida.marcas) {
    const t = 1 - m.vida / m.max;
    ctx.strokeStyle = 'rgba(255,224,138,' + (1 - t) + ')';
    ctx.lineWidth = 2 / cam.zoom;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 5 + t * 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  const capas = [];
  for (const e of partida.escombros) capas.push({ y: e.y, ruina: e });
  for (const b of partida.edificios) {
    if (b.muerto || b.hp <= 0) continue;
    capas.push({ y: b.y, edificio: b });
  }
  capas.sort((a, b) => a.y - b.y);
  for (const capa of capas) {
    if (capa.ruina) dibujarEscombro(capa.ruina);
    else if (capa.edificio.tipo === 'centro') dibujarCentro(capa.edificio);
    else if (capa.edificio.tipo === 'casa') dibujarCasa(capa.edificio);
    else dibujarCuartel(capa.edificio);
  }
  if (partida.modo === 'colocar') {
    const tipoObra = partida.construir === 'casa' ? 'casa' : 'cuartel';
    const spec = EDIF[tipoObra];
    const valida = posicionValida(punteroMundo.x, punteroMundo.y, tipoObra);
    const fantasma = {
      x: punteroMundo.x,
      y: punteroMundo.y,
      equipo: 'patriota',
      ancho: spec.ancho,
      alto: spec.alto,
      obra: 0.45,
      completo: false,
      golpe: 0,
    };
    ctx.save();
    ctx.globalAlpha = 0.62;
    if (tipoObra === 'casa') dibujarCasa(fantasma);
    else dibujarCuartel(fantasma);
    ctx.restore();
    ctx.strokeStyle = valida ? '#d7ec9a' : '#ff8f8f';
    ctx.lineWidth = 2 / cam.zoom;
    ctx.strokeRect(
      punteroMundo.x - spec.ancho / 2,
      punteroMundo.y - spec.alto / 2,
      spec.ancho,
      spec.alto
    );
  }
  const orden = partida.unidades.filter((u) => !u.muerto).sort((a, b) => a.y - b.y);
  for (const u of orden) dibujarUnidad(u);
  for (const b of partida.edificios) {
    if (b.muerto || b.hp <= 0) continue;
    if (!b.completo || b.hp < b.hpMax || partida.seleccion.indexOf(b.id) >= 0) {
      dibujarBarra(b.x, b.y - b.alto * 0.55, Math.min(54, b.ancho * 0.55), b.completo ? b.hp : b.hpMax * b.obra, b.hpMax);
    }
  }
  for (const u of orden) {
    if (u.hp < u.hpMax || partida.seleccion.indexOf(u.id) >= 0) {
      const tam = tamanoSprite(u);
      dibujarBarra(u.x, u.y - tam * (1 - PIVOTE.desdeAbajo) - 5, Math.max(26, u.radio * 2.2), u.hp, u.hpMax);
    }
  }
  for (const d of partida.disparos) {
    const t = 1 - d.vida / d.max;
    ctx.strokeStyle = 'rgba(255,236,190,0.95)';
    ctx.lineWidth = 1.4 / cam.zoom;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + (d.tx - d.x) * t, d.y + (d.ty - d.y) * t);
    ctx.stroke();
  }
  for (const p of partida.particulas) {
    ctx.globalAlpha = clamp(p.vida / (p.max || 0.4), 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.tam, p.tam);
    ctx.globalAlpha = 1;
  }
  ctx.font = '700 ' + (12 / cam.zoom) + 'px Liberation Sans, sans-serif';
  ctx.textAlign = 'center';
  for (const t of partida.textos) {
    ctx.globalAlpha = clamp(t.vida / t.max, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.texto, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  if (cam.zoom > 0.72) {
    if (edificioVivo('patriota', 'centro')) dibujarRotulo('Campamento patriota', CAMP.patriota.x, CAMP.patriota.y + 78);
    if (edificioVivo('realista', 'centro')) dibujarRotulo('Campamento realista', CAMP.realista.x, CAMP.realista.y - 78);
    dibujarRotulo('Veta expuesta', 1080, 860);
  }
  ctx.restore();
  if (gesto && gesto.modo === 'caja') {
    const x = Math.min(gesto.x0, gesto.x);
    const y = Math.min(gesto.y0, gesto.y);
    const w = Math.abs(gesto.x - gesto.x0);
    const h = Math.abs(gesto.y - gesto.y0);
    ctx.save();
    ctx.fillStyle = 'rgba(255,224,138,0.16)';
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
  dibujarMinimapa();
}

function dibujarEscombro(e) {
  const alfa = clamp(Math.min(1, e.vida / 3), 0.55, 0.95);
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 12, (e.w || 80) * 0.32, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.tipo === 'cuartel' ? '#7a5a3a' : '#8d7356';
  ctx.strokeStyle = '#2a2118';
  ctx.lineWidth = 2;
  if (e.tipo === 'cuartel') {
    ctx.fillRect(-50, -2, 100, 14);
    ctx.strokeRect(-50, -2, 100, 14);
    ctx.fillRect(-36, -16, 16, 16);
    ctx.fillRect(18, -12, 20, 12);
  } else {
    ctx.fillRect(-30, -2, 60, 16);
    ctx.strokeRect(-30, -2, 60, 16);
    ctx.beginPath();
    ctx.moveTo(-34, -2);
    ctx.lineTo(-6, -20);
    ctx.lineTo(16, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  const ruina = e.tipo === 'cuartel' ? 'Cuartel en ruinas' : e.tipo === 'casa' ? 'Casa en ruinas' : 'Centro en ruinas';
  dibujarRotulo(ruina, e.x, e.y - 34);
}

function ajustarTamano() {
  vista.dpr = Math.min(2, window.devicePixelRatio || 1);
  vista.w = Math.max(1, window.innerWidth);
  vista.h = Math.max(1, window.innerHeight);
  lienzo.style.width = vista.w + 'px';
  lienzo.style.height = vista.h + 'px';
  lienzo.width = Math.max(1, Math.floor(vista.w * vista.dpr));
  lienzo.height = Math.max(1, Math.floor(vista.h * vista.dpr));
  const rect = minimapa.getBoundingClientRect();
  mini.w = rect.width || 132;
  mini.h = rect.height || 84;
  minimapa.width = Math.max(1, Math.floor(mini.w * vista.dpr));
  minimapa.height = Math.max(1, Math.floor(mini.h * vista.dpr));
  clampCamara();
}

function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dtReal = Math.min(0.05, (ahora - ultimo) / 1000);
  ultimo = ahora;
  if (dtReal > 0) paso(dtReal);
  dibujar();
  refrescarInterfaz();
  if (!window.__LIBERTAD.listo) window.__LIBERTAD.listo = true;
}

function resumenPublico() {
  return {
    fase: partida.fase,
    resultado: partida.resultado,
    comida: Math.floor(partida.comida),
    madera: Math.floor(partida.madera),
    oro: Math.floor(partida.oro),
    tiempo: partida.tiempo,
    oleada: partida.ia ? partida.ia.oleada : 0,
    avisosOla: partida.ia ? partida.ia.avisosOla || 0 : 0,
    poblacion: calcularPoblacion(),
    tope: partida.tope,
    escala: partida.escala,
    zoom: cam.zoom,
    cam: { x: cam.x, y: cam.y },
    modo: partida.modo,
    seleccion: partida.seleccion.slice(),
    unidades: partida.unidades.filter((u) => !u.muerto).map((u) => ({
      id: u.id,
      tipo: u.tipo,
      equipo: u.equipo,
      x: u.x,
      y: u.y,
      hp: u.hp,
      hpMax: u.hpMax,
      estado: u.estado,
      objetivoId: u.objetivoId,
      nodoId: u.nodoId,
      carga: u.carga,
      cargaTipo: u.cargaTipo,
    })),
    edificios: partida.edificios.filter((b) => !b.muerto).map((b) => ({
      id: b.id,
      tipo: b.tipo,
      equipo: b.equipo,
      x: b.x,
      y: b.y,
      hp: b.hp,
      hpMax: b.hpMax,
      completo: b.completo,
      obra: b.obra,
      cola: b.cola.length,
    })),
    nodos: partida.nodos.filter((n) => n.cantidad > 0).map((n) => ({
      id: n.id,
      tipo: n.tipo,
      variante: n.variante,
      x: n.x,
      y: n.y,
      cantidad: n.cantidad,
    })),
  };
}

function ocultarCarga() {
  const capa = document.getElementById('cargando');
  if (capa) capa.classList.add('oculto');
}

function iniciar() {
  if (iniciado) return;
  iniciado = true;
  if (!ctx || !mctx) throw new Error('No hay lienzo 2D');
  const arranque = () => {
    generarSprites();
    cargarArteUnidades();
    generarTerreno();
    ajustarTamano();
    const params = new URLSearchParams(location.search);
    crearPartida({
      demo: params.has('victoria'),
      auto: params.has('auto') && !params.has('victoria'),
    });
    registrarEntrada();
    window.addEventListener('resize', ajustarTamano);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', ajustarTamano);
    document.addEventListener('visibilitychange', () => { ultimo = performance.now(); });
    ultimo = performance.now();
    dibujar();
    refrescarInterfaz();
    ocultarCarga();
    requestAnimationFrame(bucle);
  };
  ajustarTamano();
  const fino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  usaTacto = window.matchMedia('(pointer: coarse)').matches || ((navigator.maxTouchPoints || 0) > 0 && !fino);
  requestAnimationFrame(() => requestAnimationFrame(arranque));
}

window.__LIBERTAD = {
  listo: false,
  resumen: resumenPublico,
  mundoAPantalla,
  pantallaAMundo,
  tocarMundo(x, y) {
    const p = mundoAPantalla(x, y);
    manejarToque(p.x, p.y, false, false, 'touch');
    refrescarInterfaz();
  },
  escala(n) {
    partida.escala = n;
  },
  avanzar(segundos) {
    let restante = segundos;
    while (restante > 0) {
      const dt = Math.min(0.05, restante);
      paso(dt);
      restante -= dt;
    }
    dibujar();
    refrescarInterfaz();
  },
  reiniciar,
  danar(id, cantidad) {
    const e = porId(id);
    if (!e || e.muerto) return;
    e.hp -= cantidad;
    if (e.hp <= 0) morir(e);
    recogerMuertos();
    comprobarFin();
  },
};

iniciar();
