// Regras puras de GPS: distância, filtro de pontos, subida acumulada, velocidade e parciais por km.
// Não acessam DOM, storage nem relógio (testáveis no Node). Tempos `t` em epoch ms.

const RAIO_TERRA_M = 6371000;
const PRECISAO_MAX_M = 30;            // accuracy acima disso é descartada
const MIN_DESLOCAMENTO_M = 3;         // abaixo disso = parado/ruído
const LACUNA_S = 30;                  // mais que isso sem ponto = lacuna
const LIMITE_KMH = { caminhada: 12, corrida: 25 };
const HISTERESE_SUBIDA_M = 3;

const rad = g => (g * Math.PI) / 180;

// Haversine, em metros. a e b: { lat, lon }.
export function distanciaM(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Decide o que fazer com um ponto novo. `ultimo` é o último ponto ACEITO (ou null).
// Retorna { aceito, motivo, somarDistancia, novoSegmento }.
// motivos: 'primeiro' | 'ok' | 'lacuna' (aceitos) · 'precisao' | 'tempo' | 'velocidade' | 'parado' (rejeitados).
// Ponto rejeitado por 'parado' pode ainda atualizar a altitude corrente (decisão de quem chama).
export function aceitarPonto(ultimo, novo, tipo) {
  const rejeitar = motivo => ({ aceito: false, motivo, somarDistancia: false, novoSegmento: false });
  if (!(novo.accuracy <= PRECISAO_MAX_M)) return rejeitar('precisao'); // também cobre accuracy ausente/NaN
  if (!ultimo) return { aceito: true, motivo: 'primeiro', somarDistancia: false, novoSegmento: true };

  const dt = (novo.t - ultimo.t) / 1000;
  if (!(dt > 0)) return rejeitar('tempo');
  const d = distanciaM(ultimo, novo);
  const limite = LIMITE_KMH[tipo] ?? LIMITE_KMH.caminhada;
  const plausivel = (d / dt) * 3.6 <= limite;

  if (dt > LACUNA_S) {
    if (d < MIN_DESLOCAMENTO_M) return rejeitar('parado');
    return plausivel
      ? { aceito: true, motivo: 'lacuna', somarDistancia: true, novoSegmento: false }
      : { aceito: true, motivo: 'lacuna', somarDistancia: false, novoSegmento: true };
  }
  if (!plausivel) return rejeitar('velocidade');
  if (d < MIN_DESLOCAMENTO_M) return rejeitar('parado');
  return { aceito: true, motivo: 'ok', somarDistancia: true, novoSegmento: false };
}

// Subida acumulada com histerese de 3 m. Estado explícito (vai para o localStorage):
// { ref: altitude de referência | null, subida: metros acumulados }.
export function estadoSubidaInicial() {
  return { ref: null, subida: 0 };
}

// Função pura: (estado, alt) → novo estado. Sem altitude válida, devolve o mesmo estado.
// Histerese simétrica: a referência só se move quando a altitude se afasta dela ≥ 3 m.
// Subiu ≥ 3 m → soma a diferença; desceu ≥ 3 m → só rebaixa a referência (a próxima subida real conta).
// Oscilações menores que 3 m (ruído do GPS/barômetro) nunca somam.
export function ganhoSubida(estado, alt) {
  if (typeof alt !== 'number' || !Number.isFinite(alt)) return estado;
  if (estado.ref == null) return { ref: alt, subida: estado.subida };
  const dif = alt - estado.ref;
  if (dif >= HISTERESE_SUBIDA_M) return { ref: alt, subida: estado.subida + dif };
  if (dif <= -HISTERESE_SUBIDA_M) return { ref: alt, subida: estado.subida };
  return estado;
}

// Velocidade média (km/h) dos pontos aceitos nos últimos `janelaS` segundos; null se < 2 pontos.
// pontos: [{ lat, lon, t }] em ordem cronológica.
export function velocidadeRecente(pontos, agoraMs, janelaS = 30) {
  const corte = agoraMs - janelaS * 1000;
  const na = pontos.filter(p => p.t >= corte && p.t <= agoraMs);
  if (na.length < 2) return null;
  const dtS = (na.at(-1).t - na[0].t) / 1000;
  if (!(dtS > 0)) return null;
  let d = 0;
  for (let i = 1; i < na.length; i++) d += distanciaM(na[i - 1], na[i]);
  return (d / dtS) * 3.6;
}

// Tempo (s, inteiro) de cada km completo. segmentos: [[ [lat, lon, alt|null, tMs], … ], …].
// O km fecha por interpolação linear dentro do passo; o vão entre segmentos (pausa/lacuna)
// não soma distância nem tempo. → [{ km: 1, seg: 702 }, …]
export function parciaisKm(segmentos) {
  const parciais = [];
  let dist = 0, tempoMs = 0, tempoKmAnterior = 0;
  for (const seg of segmentos) {
    for (let i = 1; i < seg.length; i++) {
      const [lat0, lon0, , t0] = seg[i - 1], [lat1, lon1, , t1] = seg[i];
      const d = distanciaM({ lat: lat0, lon: lon0 }, { lat: lat1, lon: lon1 });
      const dt = t1 - t0;
      // km fechados dentro deste passo (pode ser mais de um se o passo for longo)
      let proximo = (parciais.length + 1) * 1000;
      while (d > 0 && dist + d >= proximo - 0.01) { // tolerância de 1 cm (ponto flutuante)
        const tFecha = tempoMs + ((proximo - dist) / d) * dt;
        parciais.push({ km: parciais.length + 1, seg: Math.round((tFecha - tempoKmAnterior) / 1000) });
        tempoKmAnterior = tFecha;
        proximo += 1000;
      }
      dist += d;
      tempoMs += dt;
    }
  }
  return parciais;
}
