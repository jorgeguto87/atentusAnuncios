const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, Buttons, List, MessageMedia, MessageTypes } = require('whatsapp-web.js');
const client = new Client ({
    authStrategy: new LocalAuth()
});
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

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

// Função para ler grupos já salvos (retorna array)
function lerGrupos() {
    if (!fs.existsSync(arquivoGrupos)) {
        return [];
    }
    const dados = fs.readFileSync(arquivoGrupos, 'utf-8');
    return dados.split('\n').filter(linha => linha.trim() !== '');
}

// Função para salvar um novo grupo no arquivo
function salvarGrupo(idGrupo) {
    fs.appendFileSync(arquivoGrupos, idGrupo + '\n', 'utf-8');
    console.log(`Grupo salvo: ${idGrupo}`);
}

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
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

// Função que escuta mensagens e salva grupos únicos em data.txt
function listenGroups() {
    client.on('message', async msg => {
        const from = msg.from;

        // Verifica se a mensagem é de grupo
        if (from.endsWith('@g.us')) {
            const gruposSalvos = lerGrupos();

            if (!gruposSalvos.includes(from)) {
                salvarGrupo(from);
            }
        }
    });
}

main();
