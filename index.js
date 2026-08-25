const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, Buttons, List, MessageMedia, MessageTypes } = require('whatsapp-web.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Argumentos do Puppeteer otimizados pra VPS com pouca RAM (Oracle Free
// Tier, por exemplo) — --disable-dev-shm-usage evita o Chrome tentar usar
// /dev/shm (geralmente só 64MB por padrão, trava sem esse ajuste), e
// --single-process/--no-zygote são necessários pra caber na memória
// disponível (sem eles, o Chrome abre processos demais e é derrubado por
// falta de RAM bem no meio do pareamento do QR Code).
const PUPPETEER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    '--no-zygote',
    '--disable-accelerated-2d-canvas',
    '--disable-extensions',
];

const client = new Client({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 120000,               // mais tempo pro login em CPU/conexão mais lenta
    puppeteer: {
        headless: true,
        args: PUPPETEER_ARGS,
        timeout: 120000,
    },
});

const grupos = [
    '120363039621149962@g.us', 
    '5521992884522-1634652354@g.us',
    '120363045569895184@g.us',
    '120363143030407637@g.us',
    '120363029538805156@g.us',
    '120363049713481319@g.us',
    '120363215394671433@g.us' 
];

const horarios = [
    8,11,13,15,18,21
];

// Caminho para o arquivo que armazena os grupos que enviaram mensagem
const arquivoGrupos = path.resolve(__dirname, 'data.txt');

// Função para ler grupos já salvos (retorna array só com os IDs — funciona
// tanto com linha antiga, só ID, quanto com a nova, ID + nome)
function lerGrupos() {
    if (!fs.existsSync(arquivoGrupos)) {
        return [];
    }
    const dados = fs.readFileSync(arquivoGrupos, 'utf-8');
    return dados
        .split('\n')
        .filter(linha => linha.trim() !== '')
        .map(linha => linha.split(' | ')[0].trim());
}

// Função para salvar um novo grupo no arquivo — agora salva o nome junto,
// separado por " | ", pra dar pra identificar qual é qual depois
function salvarGrupo(idGrupo, nomeGrupo) {
    const linha = `${idGrupo} | ${nomeGrupo}\n`;
    fs.appendFileSync(arquivoGrupos, linha, 'utf-8');
    console.log(`Grupo salvo: ${nomeGrupo} (${idGrupo})`);
}

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

// A partir daqui é a fase "cega" que ficava sem log nenhum — entre
// escanear o QR e o 'ready' disparar, existe uma sincronização inteira
// do WhatsApp Web acontecendo por trás. Esses eventos mostram em que
// ponto exatamente ela está (ou se trava/falha) em vez de só "sumir".

client.on('authenticated', () => {
    console.log('🔐 Autenticado! Aguardando sincronização completa...');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Carregando: ${percent}% - ${message}`);
});

client.on('disconnected', (reason) => {
    console.log('🔌 Desconectado:', reason);
});

client.initialize();

client.on('ready', async () => {
    console.log('Conectado com sucesso!');
    await main();
});
let isMainInitialized = false;

async function main() {
    if (isMainInitialized) {
        console.log('O fluxo principal já foi iniciado. Ignorando...');
        return;
    }

    isMainInitialized = true;

    try {
        console.log('Iniciando o fluxo principal...');

        // 1. Inicia o listener para mensagens e grava grupos
        listenGroups();
      
        // 2. Inicia anúncios programados
        scheduleAdvertisements();

        console.log('Fluxo principal iniciado com sucesso.');
    } catch (error) {
        console.error('Erro no fluxo principal:', error);
    }
}

function convertDateToISOFormat(date) {
    const [day, month, year] = date.split('/');
    return `${year}-${month}-${day}`; // Retorna no formato ISO
};

const data = new Date();
const horaautal = data.getHours();
const diaautal = data.getDay();
const domingao = 0;

const delay = ms => new Promise(res => setTimeout(res, ms)); 

let isAdvertisementsScheduled = false;

function scheduleAdvertisements() {
    if (isAdvertisementsScheduled) {
        console.log('Tarefas de anúncios já foram agendadas.');
        return;
    }

    isAdvertisementsScheduled = true;

    cron.schedule('0 * * * *', async () => { 
        console.log('Pronto para enviar anúncios...');

        const agora = new Date();

        //Utilizar para quando estiver rodando no servidor
        //const horaUTC = agora.getUTCHours();
        //const horaAtual = (horaUTC + 3) % 24;
        
        //Utilizar rodando localmente
        const horaAtual = agora.getHours();

        const diaAtual = agora.getDay(); 
    
        if (diaAtual >= 1 && diaAtual <= 6 && horarios.includes(horaAtual)) {
            const imagens = [
                './diaum.jpg',   // Segunda-feira
                './diadois.jpg', // Terça-feira
                './diatres.jpg', // Quarta-feira
                './diaquatro.jpg', // Quinta-feira
                './diacinco.jpg', // Sexta-feira
                './diaseis.jpg'   // Sábado
            ];
    
            const caminhoImagem = imagens[diaAtual - 1];
    
            if (!fs.existsSync(caminhoImagem)) {
                console.error(`Arquivo de imagem não encontrado: ${caminhoImagem}`);
                return;
            }
    
            const anuncio = MessageMedia.fromFilePath(caminhoImagem);
            const mensagem = '🍽️ CHEGA DE PAGAR COMISSÃO PRO APP DE ENTREGA! 🚀\n\nVocê tem restaurante, hamburgueria, pizzaria ou delivery e quer vender mais sem perder dinheiro com comissão? Conheça o Eu Cardápio! 👇\n\n✅ Cardápio digital com a cara do seu negócio\n✅ Pedido automático pelo WhatsApp\n✅ Pagamento direto na SUA conta (Pix, cartão)\n✅ QR Code pra pedido na mesa\n✅ Cupom e cashback pra cliente sempre voltar\n✅ Painel completo de gestão, tudo numa tela só\n\n💰 Assinatura fixa — sem comissão nenhuma por pedido!\n\n📲 Teste grátis por 7 dias, sem cartão de crédito\n👇🏼 Veja como funciona:\nhttps://portal.eucardapio.com.br';
    
            for (const grupo of grupos) {
                try {
                    await client.sendMessage(grupo, anuncio, { caption: mensagem });
                    console.log(`Mensagem enviada para o grupo: ${grupo}`);
                } catch (error) {
                    console.error(`Erro ao enviar mensagem para o grupo ${grupo}:`, error);
                }
            }
        }
    });
}

// Guarda em memória os grupos já vistos NESSA execução — checado e
// marcado de forma síncrona, antes de qualquer busca assíncrona (nome,
// escrita em arquivo). Isso fecha a brecha que fazia 'message' e
// 'message_create' salvarem o mesmo grupo duas vezes quase ao mesmo
// tempo (reler o arquivo sozinho não é rápido o suficiente pra evitar
// isso — os dois liam "ainda não existe" antes de qualquer um escrever).
const gruposEmMemoria = new Set(lerGrupos());

// Função que escuta mensagens e salva grupos únicos em data.txt — agora
// busca o nome do grupo antes de salvar, pra facilitar identificar depois
function listenGroups() {
    async function processarGrupo(msg) {
        // Cobre tanto mensagem RECEBIDA de um grupo quanto ENVIADA pelo
        // próprio bot pra um grupo (msg.to) — importante porque esse bot
        // manda anúncio o tempo todo, mas quase não recebe mensagem de
        // volta, então só escutar 'message' raramente capturava o grupo
        const isFromGroup = msg.from.endsWith('@g.us');
        const isToGroup = msg.to && msg.to.endsWith('@g.us');
        if (!isFromGroup && !isToGroup) return;

        const grupoId = isFromGroup ? msg.from : msg.to;

        // Checa E marca como visto na mesma linha, de forma síncrona —
        // se 'message' e 'message_create' chegarem quase juntos pro
        // mesmo grupo, só o primeiro a passar aqui segue adiante
        if (gruposEmMemoria.has(grupoId)) return;
        gruposEmMemoria.add(grupoId);

        try {
            const chat = await msg.getChat();
            const nomeGrupo = chat.name || 'Nome não disponível';
            salvarGrupo(grupoId, nomeGrupo);
        } catch (error) {
            console.error(`Erro ao buscar nome do grupo ${grupoId}:`, error.message);
            salvarGrupo(grupoId, 'Nome não disponível');
        }
    }

    // Escuta mensagem recebida...
    client.on('message', async msg => {
        await processarGrupo(msg);
    });

    // ...e também mensagem enviada pelo próprio bot (essencial pro caso
    // de um bot que só manda anúncio, quase não recebe resposta)
    client.on('message_create', async msg => {
        await processarGrupo(msg);
    });
}

main();
