// Coleção de achados (J12a): o ⭐ achado raro do saque vira um destes. Cada um conta um pedaço da história (a Galiza e o surto)
// em 2 linhas, sem cena de cinema. A ordem é a do álbum na tela "Coleção"; o id nunca muda (fica no save).
export const FINDS = [
  // 📻 fitas do rádio da paróquia (contam a história em ordem)
  { id: 'fita-1', icon: '📻', title: 'Fita do rádio nº 1', text: ['Boa noite, paróquia. A missa de domingo está suspensa.', 'O padre Xosé pede que ninguém saia depois do sino das oito.'] },
  { id: 'fita-2', icon: '📻', title: 'Fita do rádio nº 2', text: ['Os pescadores voltaram do porto com febre e olhos vermelhos.', 'Quem foi visitar um deles não voltou para casa.'] },
  { id: 'fita-3', icon: '📻', title: 'Fita do rádio nº 3', text: ['A N-550 está fechada no posto do km 0.', 'O exército diz que é por poucos dias. Ninguém acredita.'] },
  { id: 'fita-4', icon: '📻', title: 'Fita do rádio nº 4', text: ['Não abram a porta para quem bate devagar.', 'Gente viva bate com pressa.'] },
  { id: 'fita-5', icon: '📻', title: 'Fita do rádio nº 5', text: ['Os mortos ouvem martelo de longe. Preguem as tábuas de dia.', 'À noite, só sussurros e velas.'] },
  { id: 'fita-6', icon: '📻', title: 'Fita do rádio nº 6', text: ['A avó Carmiña viu luzes passando na estrada à meia-noite.', 'Disse que era a Santa Compaña vindo buscar a paróquia.'] },
  { id: 'fita-7', icon: '📻', title: 'Fita do rádio nº 7', text: ['Rádio do exército: aguentem até o amanhecer do terceiro dia.', 'Os caminhões vêm pela N-550, de Santiago.'] },
  { id: 'fita-8', icon: '📻', title: 'Fita do rádio nº 8', text: ['Se alguém ouvir esta fita: nós aguentamos.', 'Deixamos tábuas e remédio no sótão da casa azul.'] },
  // 📜 cartas e bilhetes
  { id: 'carta-avo', icon: '📜', title: 'Carta da avó', text: ['Meu neto, se a febre chegar à aldeia, suba ao sótão com o rosário.', 'Os mortos não sabem subir escadas depressa.'] },
  { id: 'carta-vigo', icon: '📜', title: 'Carta de Vigo', text: ['O porto está cheio de navios que ninguém deixa atracar.', 'Dizem que a doença veio no peixe. Eu acho que veio no medo.'] },
  { id: 'bilhete-geladeira', icon: '📜', title: 'Bilhete na geladeira', text: ['Fui buscar gasolina no posto. Volto antes de escurecer.', '— Manolo'] },
  { id: 'carta-emigrante', icon: '📜', title: 'Carta do emigrante', text: ['Trabalhei trinta anos na Suíça para voltar à minha aldeia.', 'Pelo menos aqui o vento ainda cheira a eucalipto.'] },
  { id: 'lista-compras', icon: '📜', title: 'Lista de compras', text: ['Pão, sal, velas, pregos de 7 cm, mais velas.', 'Não esquecer: a cruz do avô no batente da porta.'] },
  { id: 'carta-amor', icon: '📜', title: 'Carta de amor', text: ['Espera-me no cruzeiro da praça quando os sinos tocarem.', 'Se eu não vier, não me procures à noite.'] },
  { id: 'recado-padre', icon: '📜', title: 'Recado do padre', text: ['Os sinos agora só tocam para avisar.', 'Se ouvirem três toques, fechem as janelas do térreo.'] },
  { id: 'diario-menina', icon: '📜', title: 'Diário de uma menina', text: ['Hoje o cão não parou de latir para o bosque.', 'Papai pregou a janela da cozinha e disse que era o vento.'] },
  { id: 'carta-carteiro', icon: '📜', title: 'Última entrega do carteiro', text: ['Ninguém responde nas casas da estrada velha.', 'Deixei as cartas nas caixas. Alguém há de lê-las.'] },
  { id: 'testamento', icon: '📜', title: 'Testamento', text: ['Deixo a vaca ao vizinho e a escopeta à minha filha.', 'A casa fica para quem conseguir defendê-la.'] },
  // 📷 fotos
  { id: 'foto-romaria', icon: '📷', title: 'Foto da romaria', text: ['A romaria de agosto, com polvo e gaita na praça.', 'No verso: "O último verão normal."'] },
  { id: 'foto-casamento', icon: '📷', title: 'Foto do casamento', text: ['Os noivos saem da igreja sob arroz e chuva fina.', 'Alguém riscou o rosto do padrinho com caneta.'] },
  { id: 'foto-horreo', icon: '📷', title: 'Foto do hórreo', text: ['O hórreo da família, com a cruz no telhado de pedra.', 'No verso: "Aqui guardávamos o milho. Agora, munição."'] },
  { id: 'foto-ria', icon: '📷', title: 'Foto da ria', text: ['Crianças correndo na areia com a maré baixa.', 'No verso: "Antes de fecharem a ponte."'] },
  { id: 'foto-barreira', icon: '📷', title: 'Foto da barreira', text: ['Soldados montando uma barreira no posto de gasolina.', 'Um deles acena para a câmera. Parece ter medo.'] },
  { id: 'foto-gaiteiro', icon: '📷', title: 'Foto do gaiteiro', text: ['O gaiteiro da festa, de boina, tocando uma muiñeira.', 'Dizem que a música dele ainda acalma os vivos.'] },
  { id: 'foto-velas', icon: '📷', title: 'Foto tirada da janela', text: ['Uma fila de velas numa estrada escura, à meia-noite.', 'Ninguém aparece na foto. Só as velas.'] },
  { id: 'foto-familia', icon: '📷', title: 'Foto de família', text: ['Três gerações à mesa, com empanada e vinho do Ribeiro.', 'Duas cadeiras vazias foram marcadas com uma cruz.'] },
  // 📰 recortes e objetos
  { id: 'jornal', icon: '📰', title: 'Recorte de jornal', text: ['"Febre misteriosa em aldeias da Costa da Morte."', 'A notícia ocupa só um canto da página 12.'] },
  { id: 'mapa', icon: '🗺️', title: 'Mapa rabiscado', text: ['As vilas da região riscadas uma a uma, a caneta.', 'Só a paróquia tem um círculo: "aqui ainda há gente".'] },
  { id: 'vieira', icon: '🐚', title: 'Vieira de Santiago', text: ['Uma vieira de prata dos peregrinos do Caminho.', 'Gravado atrás: "Que o apóstolo te traga de volta."'] },
  { id: 'ordem-exercito', icon: '📰', title: 'Ordem do exército', text: ['Evacuação suspensa. Repito: evacuação suspensa.', 'Resgate só ao amanhecer. Mantenham as luzes apagadas.'] },
]
