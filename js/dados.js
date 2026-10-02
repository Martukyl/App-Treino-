// Dados padrão do app: grupos musculares, catálogo de exercícios e a divisão de 5 dias.
// Fonte: spec §4 e §5. Ao mudar algo aqui, a migração adiciona exercícios novos ao catálogo salvo.

export const GRUPOS = {
  gluteo: 'Glúteo', quadriceps: 'Quadríceps', posterior: 'Posterior de coxa',
  panturrilha: 'Panturrilha', costas: 'Costas', peito: 'Peito', ombro: 'Ombro',
  biceps: 'Bíceps', triceps: 'Tríceps', abdomen: 'Abdômen'
};

export const EQUIPAMENTOS = {
  barra: 'Barra', maquina: 'Máquina', halter: 'Halteres',
  cabo: 'Cabo/polia', peso_corporal: 'Peso corporal'
};

// cria o objeto Exercicio com os campos na ordem do spec
function ex(id, nome, grupo, tipo, equipamento, unilateral, incremento, dica) {
  return { id, nome, grupo, tipo, equipamento, unilateral, incremento, dica, personalizado: false };
}

const lista = [
  ex('elevacao_pelvica', 'Elevação pélvica com barra', 'gluteo', 'composto', 'barra', false, 2.5,
    'Costas apoiadas no banco na linha das escápulas, pés na largura do quadril. Suba contraindo o glúteo até alinhar quadril e tronco, queixo levemente recolhido. Segure 1 s no topo.'),
  ex('bulgaro', 'Agachamento búlgaro com halteres', 'gluteo', 'composto', 'halter', true, 1,
    'Pé de trás apoiado no banco, passo largo. Incline levemente o tronco à frente para puxar mais glúteo. Desça até o joelho de trás quase tocar o chão. Termine uma perna e troque.'),
  ex('stiff', 'Stiff com barra', 'posterior', 'composto', 'barra', false, 2.5,
    'Joelhos levemente flexionados e fixos. Leve o quadril para trás com a barra rente às pernas e a coluna neutra. Desça até alongar o posterior e volte contraindo o glúteo.'),
  ex('abducao', 'Cadeira abdutora', 'gluteo', 'isolado', 'maquina', false, 2.5,
    'Tronco levemente inclinado à frente aumenta o trabalho do glúteo. Abra com controle, segure 1 s aberta e volte devagar.'),
  ex('flexora_sentada', 'Cadeira flexora', 'posterior', 'isolado', 'maquina', false, 2.5,
    'Ajuste o encosto para o joelho ficar alinhado ao eixo da máquina. Flexione até o fim e volte em 2–3 s sem deixar o peso bater.'),
  ex('agachamento', 'Agachamento livre (ou no smith)', 'quadriceps', 'composto', 'barra', false, 2.5,
    'Pés na largura dos ombros, pontas levemente para fora. Desça com os joelhos na direção dos pés até pelo menos a coxa paralela, peito aberto e calcanhar no chão.'),
  ex('leg_press', 'Leg press 45°', 'quadriceps', 'composto', 'maquina', false, 5,
    'Pés no meio da plataforma, largura do quadril. Desça até uns 90° de joelho sem tirar o quadril do banco. Não trave os joelhos ao subir.'),
  ex('extensora', 'Cadeira extensora', 'quadriceps', 'isolado', 'maquina', false, 2.5,
    'Joelho alinhado ao eixo da máquina. Estenda até o fim, segure 1 s e desça controlando.'),
  ex('afundo', 'Afundo com halteres', 'quadriceps', 'composto', 'halter', true, 1,
    'Passo longo o bastante para os dois joelhos formarem uns 90°. Empurre com o calcanhar da frente para voltar, tronco firme.'),
  ex('panturrilha', 'Panturrilha em pé', 'panturrilha', 'isolado', 'maquina', false, 2.5,
    'Desça até alongar bem o calcanhar e suba ao máximo na ponta dos pés, com pausa de 1 s em cima e embaixo.'),
  ex('terra_romeno', 'Terra romeno com halteres', 'posterior', 'composto', 'halter', false, 2,
    'Halteres à frente das coxas, joelhos levemente flexionados. Leve o quadril para trás deslizando os halteres pelas pernas, coluna neutra, e suba contraindo o glúteo.'),
  ex('glute_bridge', 'Ponte de glúteo com barra', 'gluteo', 'composto', 'barra', false, 2.5,
    'Deitada no chão com a barra no quadril (use protetor). Pés próximos ao glúteo; suba contraindo e segure 1–2 s no topo.'),
  ex('mesa_flexora', 'Mesa flexora', 'posterior', 'isolado', 'maquina', false, 2.5,
    'Deitada, quadril colado no banco. Flexione até o fim sem levantar o quadril e desça em 2–3 s.'),
  ex('coice_cabo', 'Coice de glúteo no cabo', 'gluteo', 'isolado', 'cabo', true, 2.5,
    'Tornozeleira no cabo, tronco levemente inclinado e abdômen firme. Leve a perna para trás e para cima sem arquear a lombar; contraia o glúteo no fim.'),
  ex('puxada_frente', 'Puxada frontal aberta', 'costas', 'composto', 'cabo', false, 2.5,
    'Pegada um pouco mais aberta que os ombros. Puxe a barra até o alto do peito levando os cotovelos para baixo e para trás, peito alto, sem balançar o tronco.'),
  ex('remada_baixa', 'Remada baixa com triângulo', 'costas', 'composto', 'cabo', false, 2.5,
    'Coluna neutra. Puxe o triângulo até o umbigo apertando as escápulas e volte alongando as costas sem curvar a lombar.'),
  ex('desenvolvimento_halter', 'Desenvolvimento com halteres', 'ombro', 'composto', 'halter', false, 1,
    'Banco a ~80°, halteres na altura das orelhas. Empurre para cima sem bater um no outro e desça até os cotovelos ficarem um pouco abaixo dos ombros.'),
  ex('elevacao_lateral', 'Elevação lateral', 'ombro', 'isolado', 'halter', false, 1,
    'Cotovelos levemente flexionados. Suba até a altura dos ombros conduzindo pelos cotovelos, sem impulso, e desça devagar.'),
  ex('rosca_direta', 'Rosca direta com barra W', 'biceps', 'isolado', 'barra', false, 2,
    'Cotovelos colados ao corpo. Suba sem balançar o tronco e desça controlando até quase estender.'),
  ex('triceps_corda', 'Tríceps na polia com corda', 'triceps', 'isolado', 'cabo', false, 2.5,
    'Cotovelos fixos ao lado do corpo. Estenda e abra a corda no final; volte até uns 90° sem subir os cotovelos.'),
  ex('supino_inclinado', 'Supino inclinado com halteres', 'peito', 'composto', 'halter', false, 1,
    'Banco a 30°, escápulas encaixadas. Desça os halteres ao lado do peito com cotovelos a ~45° do corpo e empurre para cima.'),
  ex('remada_unilateral', 'Remada unilateral com halter', 'costas', 'composto', 'halter', true, 2,
    'Mão e joelho apoiados no banco, coluna reta. Puxe o halter em direção ao quadril com o cotovelo rente ao corpo.'),
  ex('crucifixo_invertido', 'Crucifixo invertido na máquina', 'ombro', 'isolado', 'maquina', false, 2.5,
    'Peito apoiado, braços quase estendidos. Abra os braços para trás até a linha dos ombros, sem encolher o pescoço.'),
  ex('rosca_alternada', 'Rosca alternada com halteres', 'biceps', 'isolado', 'halter', false, 1,
    'Gire a palma para cima durante a subida. Cotovelo parado, um braço de cada vez.'),
  ex('triceps_frances', 'Tríceps francês com halter', 'triceps', 'isolado', 'halter', false, 1,
    'Sentada, segure um halter com as duas mãos atrás da cabeça. Estenda os braços sem abrir os cotovelos.')
];

export const exerciciosPadrao = Object.fromEntries(lista.map(e => [e.id, e]));

// item de treino: exercício, séries, faixa de repetições e descanso em segundos
function it(exercicioId, series, repMin, repMax, descanso) {
  return { exercicioId, series, repMin, repMax, descanso };
}

export const treinosPadrao = [
  { id: 'A', nome: 'Inferiores — Glúteo', foco: 'Glúteo', itens: [
    it('elevacao_pelvica', 4, 8, 12, 120),
    it('bulgaro', 3, 8, 12, 90),
    it('stiff', 3, 8, 12, 120),
    it('abducao', 3, 12, 15, 60),
    it('flexora_sentada', 3, 10, 15, 60)
  ] },
  { id: 'B', nome: 'Superiores — Costas e ombro', foco: 'Costas e ombro', itens: [
    it('puxada_frente', 4, 8, 12, 90),
    it('remada_baixa', 3, 8, 12, 90),
    it('desenvolvimento_halter', 3, 8, 12, 90),
    it('elevacao_lateral', 4, 12, 15, 60),
    it('rosca_direta', 3, 10, 12, 60),
    it('triceps_corda', 3, 10, 15, 60)
  ] },
  { id: 'C', nome: 'Inferiores — Quadríceps', foco: 'Quadríceps', itens: [
    it('agachamento', 4, 6, 10, 120),
    it('leg_press', 4, 8, 12, 120),
    it('extensora', 3, 10, 15, 60),
    it('afundo', 3, 10, 12, 90),
    it('panturrilha', 4, 12, 15, 45)
  ] },
  { id: 'D', nome: 'Superiores — Peito, ombro e braços', foco: 'Peito, ombro e braços', itens: [
    it('supino_inclinado', 3, 8, 12, 90),
    it('remada_unilateral', 3, 8, 12, 90),
    it('elevacao_lateral', 3, 12, 15, 60),
    it('crucifixo_invertido', 3, 12, 15, 60),
    it('rosca_alternada', 3, 10, 12, 60),
    it('triceps_frances', 3, 10, 12, 60)
  ] },
  { id: 'E', nome: 'Inferiores — Glúteo e posterior', foco: 'Glúteo e posterior', itens: [
    it('terra_romeno', 3, 8, 12, 120),
    it('glute_bridge', 3, 10, 15, 90),
    it('mesa_flexora', 3, 10, 12, 60),
    it('coice_cabo', 3, 12, 15, 60),
    it('abducao', 3, 12, 15, 60),
    it('panturrilha', 4, 12, 15, 45)
  ] }
];
