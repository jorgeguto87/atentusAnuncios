const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode-terminal');

// ─── Configuração da Evolution API ─────────────────────────────────────
const EVOLUTION_URL = 'http://localhost:8082';
const EVOLUTION_APIKEY = '429683C4C977415CAAFCCE10F7D57E11';
const EVOLUTION_INSTANCE = 'teste-anuncios';

const evolutionApi = axios.create({
    baseURL: EVOLUTION_URL,
    headers: { apikey: EVOLUTION_APIKEY },
});

const grupos = [
    '5521980046672-1436734547@g.us',
    '120363049713481319@g.us',
    '5521999433003-1635860591@g.us',
    '120363427102128054@g.us',
    '120363406011897890@g.us',
    '120363143030407637@g.us',
    '120363029538805156@g.us',
    '120363045569895184@g.us',
    '120363039621149962@g.us',
    '120363041290501948@g.us',
    '5521992884522-1634652354@g.us',
    '120363164687603985@g.us',
    '120363215394671433@g.us',
    '120363028563126365@g.us',
    '120363183587705852@g.us',
    '120363146910033270@g.us'
];

const horarios = [8, 11, 13, 15, 18, 21];

const MENSAGENS_MINIMAS_ENTRE_ENVIOS = 5;
const ARQUIVO_ULTIMO_ENVIO = path.resolve(__dirname, 'ultimo_envio.json');

// ─── Sorteio de imagem + mensagem ───────────────────────────────────────
// Em vez de escolher a imagem pelo dia da semana, sorteia um número de
// 0 a 5 e usa o par (imagem, mensagem) correspondente àquele índice —
// mesma imagem+mensagem pra todos os grupos naquela rodada de envio.
const imagens = ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg', 'img6.jpg'];

const mensagens = [
    '🍽️ CHEGA DE PAGAR COMISSÃO PRO APP DE ENTREGA! 🚀\n\nVocê tem restaurante, hamburgueria, pizzaria ou delivery e quer vender mais sem perder dinheiro com comissão? Conheça o Eu Cardápio! 👇\n\n✅ Cardápio digital com a cara do seu negócio\n✅ Pedido automático pelo WhatsApp\n✅ Pagamento direto na SUA conta (Pix, cartão)\n✅ QR Code pra pedido na mesa\n✅ Cupom e cashback pra cliente sempre voltar\n✅ Painel completo de gestão, tudo numa tela só\n\n💰 Assinatura fixa — sem comissão nenhuma por pedido!\n\n📲 Teste grátis por 7 dias, sem cartão de crédito\n👇🏼 Veja como funciona:\nhttps://portal.eucardapio.com.br', // msg1
    '🍽️ SEU CARDÁPIO DIGITAL PROFISSIONAL, DO JEITO QUE SEU CLIENTE MERECE! 🚀\n\nSeu cliente ainda precisa ficar pedindo o cardápio pelo WhatsApp ou esperando alguém responder? 😩\n\nCom o Eu Cardápio, seu cliente acessa tudo de forma rápida, bonita e fácil! 👇\n\n✅ Cardápio digital com a cara do seu negócio\n✅ Fotos, preços e informações dos produtos\n✅ Pedido automático pelo WhatsApp\n✅ Cliente faz o pedido sem precisar falar com atendente\n✅ QR Code para acesso ao cardápio\n✅ Cupons e cashback para trazer o cliente de volta\n\n💰 E o melhor: você paga uma assinatura fixa, SEM comissão por pedido!\n\n📲 TESTE GRÁTIS POR 7 DIAS, SEM CARTÃO DE CRÉDITO!\n\n👇🏼 Conheça o Eu Cardápio:\nhttps://portal.eucardapio.com.br', // msg2
    '📱 SEU CLIENTE SENTOU NA MESA? É SÓ APONTAR A CÂMERA! 🍽️🚀\n\nChega de entregar cardápio impresso, esperar o garçom ou ficar levando pedido de uma mesa para outra!\n\nCom o QR Code do Eu Cardápio, seu cliente aponta a câmera do celular e já acessa o seu cardápio digital. 👇\n\n✅ QR Code exclusivo para o seu negócio\n✅ Cliente acessa o cardápio direto pelo celular\n✅ Mais agilidade no atendimento\n✅ Pedido direto pelo WhatsApp\n✅ Menos espera para fazer o pedido\n✅ Cardápio sempre atualizado\n\n💡 Ideal para restaurantes, pizzarias, hamburguerias, lanchonetes e muito mais!\n\n💰 Assinatura fixa — SEM comissão por pedido!\n\n📲 TESTE GRÁTIS POR 7 DIAS, SEM CARTÃO DE CRÉDITO!\n\n👇🏼 Veja como funciona:\nhttps://portal.eucardapio.com.br', // msg3
    '🛵 SEU CLIENTE PRECISA SABER ONDE ESTÁ O PEDIDO? DEIXE O EU CARDÁPIO AVISAR! 📲🚀\n\nChega de cliente mandando mensagem toda hora perguntando: “Meu pedido já saiu?” ou “O entregador está chegando?” 😅\n\nCom o Eu Cardápio, a comunicação fica muito mais organizada! 👇\n\n✅ Mensagem avisando que o pedido está saindo\n✅ Aviso quando o entregador está a caminho\n✅ Mensagem quando o entregador chega ao local\n✅ Mais informação para o cliente\n✅ Mais praticidade para o entregador\n✅ Tudo integrado à rotina do seu delivery\n\n🚀 Seu cliente fica informado e sua equipe perde menos tempo respondendo mensagens repetitivas!\n\n💰 E sem pagar comissão por cada pedido.\n\n📲 TESTE GRÁTIS POR 7 DIAS, SEM CARTÃO DE CRÉDITO!\n\n👇🏼 Conheça o Eu Cardápio:\nhttps://portal.eucardapio.com.br', // msg4
    '💰 VENDEU? O DINHEIRO É SEU! 🚀\n\nPor que esperar o prazo de um aplicativo para receber pelo seu próprio pedido?\n\nCom o Eu Cardápio, o pagamento dos pedidos vai DIRETO PARA A SUA CONTA! 👇\n\n✅ Pix direto na sua conta\n✅ Pagamento com cartão\n✅ Mais controle sobre o seu dinheiro\n✅ Venda sem pagar comissão por pedido\n✅ Assinatura fixa, sem surpresa no final do mês\n✅ Seu negócio vende, você recebe!\n\n🔥 Pare de entregar uma parte do seu faturamento para aplicativos de entrega.\n\nTenha seu próprio canal de vendas e mantenha muito mais controle sobre o seu negócio!\n\n📲 TESTE GRÁTIS POR 7 DIAS, SEM CARTÃO DE CRÉDITO!\n\n👇🏼 Veja como funciona:\nhttps://portal.eucardapio.com.br', // msg5
    '📱💻 SEU DELIVERY NA PALMA DA MÃO — OU NA TELA DO COMPUTADOR! 🚀\n\nJá imaginou poder acompanhar e administrar seu negócio de onde estiver?\n\nCom o painel do Eu Cardápio, você pode acessar seu sistema pelo celular, tablet ou computador. 👇\n\n✅ Acesse pelo celular\n✅ Acesse pelo computador\n✅ Acompanhe seus pedidos\n✅ Gerencie seu cardápio\n✅ Tenha controle do seu delivery\n✅ Tudo em um painel completo e fácil de usar\n\n🏪 Está no restaurante? Use o computador.\n📱 Está fora? Acesse pelo celular.\n\nSeu negócio continua na sua mão, onde você estiver! 🚀\n\n💰 E tudo isso com assinatura fixa, SEM comissão por pedido.\n\n📲 TESTE GRÁTIS POR 7 DIAS, SEM CARTÃO DE CRÉDITO!\n\n👇🏼 Conheça o Eu Cardápio:\nhttps://portal.eucardapio.com.br', // msg6
];

// Sorteia um índice de 0 a (imagens.length - 1) — Math.random() nunca
// chega a 1, então parseInt(Math.random() * 6) só produz 0,1,2,3,4,5,
// nunca 6. Não tem como "vazar" pra fora do array.
function sortearIndice() {
    return parseInt(Math.random() * imagens.length);
}

function lerUltimoEnvioPorGrupo() {
    if (!fs.existsSync(ARQUIVO_ULTIMO_ENVIO)) return {};
    try {
        return JSON.parse(fs.readFileSync(ARQUIVO_ULTIMO_ENVIO, 'utf-8'));
    } catch {
        return {};
    }
}

function salvarUltimoEnvioPorGrupo(dados) {
    fs.writeFileSync(ARQUIVO_ULTIMO_ENVIO, JSON.stringify(dados, null, 2), 'utf-8');
}

async function contarMensagensNovasDesde(grupoId, timestampUltimoEnvio) {
    if (!timestampUltimoEnvio) return MENSAGENS_MINIMAS_ENTRE_ENVIOS;

    try {
        const resposta = await evolutionApi.post(`/chat/findMessages/${EVOLUTION_INSTANCE}`, {
            where: { key: { remoteJid: grupoId } },
        });

        const mensagensChat = Array.isArray(resposta.data) ? resposta.data : resposta.data?.messages || [];

        const novasDeOutros = mensagensChat.filter((m) => {
            const timestamp = m.messageTimestamp || m.message_timestamp;
            const deOutraPessoa = m.key?.fromMe === false || m.fromMe === false;
            return deOutraPessoa && timestamp > timestampUltimoEnvio;
        });

        return novasDeOutros.length;
    } catch (error) {
        console.error(`Erro ao contar mensagens do grupo ${grupoId}:`, error.response?.data || error.message);
        return MENSAGENS_MINIMAS_ENTRE_ENVIOS;
    }
}

async function listarGruposDisponiveis() {
    try {
        const resposta = await evolutionApi.get(`/group/fetchAllGroups/${EVOLUTION_INSTANCE}?getParticipants=false`);
        const linhas = resposta.data
            .map((g) => `${g.id} | ${g.subject || 'Nome não disponível'}`)
            .join('\n');
        fs.writeFileSync(path.resolve(__dirname, 'grupos_disponiveis.txt'), linhas, 'utf-8');
        console.log(`📋 ${resposta.data.length} grupos encontrados — salvos em grupos_disponiveis.txt`);
        return resposta.data;
    } catch (error) {
        console.error('Erro ao listar grupos:', error.response?.data || error.message);
        return [];
    }
}

// ─── Envio em si — sorteia UMA vez por rodada (não por grupo, todos os
// grupos dessa rodada recebem o mesmo par imagem+mensagem sorteado) ─────
async function enviarAnuncioParaTodosGrupos() {
    const indiceSorteado = sortearIndice();
    const caminhoImagem = `./${imagens[indiceSorteado]}`;
    const mensagem = mensagens[indiceSorteado];

    console.log(`🎲 Sorteio: índice ${indiceSorteado} — imagem "${imagens[indiceSorteado]}"`);

    if (!fs.existsSync(caminhoImagem)) {
        const erro = `Arquivo de imagem não encontrado: ${caminhoImagem}`;
        console.error(erro);
        return { sucesso: false, erro };
    }

    const mediaBase64 = fs.readFileSync(caminhoImagem, { encoding: 'base64' });
    const extensao = path.extname(caminhoImagem).replace('.', '');
    const mimetype = extensao === 'png' ? 'image/png' : 'image/jpeg';

    const resultados = [];
    const ultimoEnvio = lerUltimoEnvioPorGrupo();

    for (const grupo of grupos) {
        const timestampAnterior = ultimoEnvio[grupo];
        const mensagensNovas = await contarMensagensNovasDesde(grupo, timestampAnterior);

        if (mensagensNovas < MENSAGENS_MINIMAS_ENTRE_ENVIOS) {
            console.log(`⏭️  Grupo ${grupo} pulado — só ${mensagensNovas} mensagem(ns) nova(s) desde o último envio (mínimo: ${MENSAGENS_MINIMAS_ENTRE_ENVIOS}).`);
            resultados.push({ grupo, sucesso: true, pulado: true, mensagensNovas });
            continue;
        }

        try {
            await evolutionApi.post(`/message/sendMedia/${EVOLUTION_INSTANCE}`, {
                number: grupo,
                mediatype: 'image',
                mimetype,
                caption: mensagem,
                media: mediaBase64,
                fileName: imagens[indiceSorteado],
            });
            console.log(`Mensagem enviada para o grupo: ${grupo} (${mensagensNovas} mensagens novas desde o último envio)`);
            resultados.push({ grupo, sucesso: true, imagemSorteada: imagens[indiceSorteado] });

            ultimoEnvio[grupo] = Math.floor(Date.now() / 1000);
            salvarUltimoEnvioPorGrupo(ultimoEnvio);

            await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
            const detalhe = error.response?.data || error.message;
            console.error(`Erro ao enviar mensagem para o grupo ${grupo}:`, detalhe);
            resultados.push({ grupo, sucesso: false, erro: detalhe });
        }
    }
    return { sucesso: true, indiceSorteado, resultados };
}

function getHoraEDiaBrasilia() {
    const agora = new Date();
    const horaUTC = agora.getUTCHours();
    const horaBrasilia = (horaUTC + 24 - 3) % 24;

    const viraDia = horaUTC < 3;
    const diaUTC = agora.getUTCDay();
    const diaBrasilia = viraDia ? (diaUTC + 6) % 7 : diaUTC;

    return { horaAtual: horaBrasilia, diaAtual: diaBrasilia };
}

function scheduleAdvertisements() {
    cron.schedule('0 * * * *', async () => {
        console.log('Pronto para enviar anúncios...');

        const { horaAtual, diaAtual } = getHoraEDiaBrasilia();

        // Continua só de segunda a sábado, nos horários configurados —
        // só a ESCOLHA da imagem/mensagem virou sorteio, o "quando enviar"
        // continua igual
        if (diaAtual >= 1 && diaAtual <= 6 && horarios.includes(horaAtual)) {
            await enviarAnuncioParaTodosGrupos();
        }
    });
    console.log('📅 Agendamento de anúncios ativo.');
}

function iniciarServidorTeste() {
    const app = express();
    const PORTA_TESTE = 3999;

    app.get('/testar-envio', async (req, res) => {
        const { diaAtual } = getHoraEDiaBrasilia();
        if (diaAtual === 0) {
            return res.status(400).json({ sucesso: false, erro: 'Hoje é domingo, não tem anúncio configurado pra esse dia.' });
        }
        console.log('🧪 Teste manual disparado via rota HTTP');
        const resultado = await enviarAnuncioParaTodosGrupos();
        res.json(resultado);
    });

    app.get('/listar-grupos', async (req, res) => {
        const grupos = await listarGruposDisponiveis();
        res.json(grupos);
    });

    app.listen(PORTA_TESTE, '127.0.0.1', () => {
        console.log(`🧪 Rota de teste disponível em http://127.0.0.1:${PORTA_TESTE}/testar-envio`);
        console.log(`📋 Lista de grupos disponível em http://127.0.0.1:${PORTA_TESTE}/listar-grupos`);
    });
}

async function garantirConectado() {
    for (let tentativa = 1; tentativa <= 24; tentativa++) {
        const resposta = await evolutionApi.get(`/instance/fetchInstances?instanceName=${EVOLUTION_INSTANCE}`);
        const status = resposta.data?.[0]?.connectionStatus;

        if (status === 'open') {
            console.log(`✅ Instância "${EVOLUTION_INSTANCE}" conectada.`);
            return true;
        }

        if (tentativa === 1) {
            console.log(`⚠️  Instância "${EVOLUTION_INSTANCE}" não conectada (status: ${status}). Buscando QR Code...`);
            const qrResposta = await evolutionApi.get(`/instance/connect/${EVOLUTION_INSTANCE}`);
            if (qrResposta.data?.code) {
                qrcode.generate(qrResposta.data.code, { small: true });
                console.log('📲 Escaneie o QR Code acima com o WhatsApp.');
            } else {
                console.error('Não veio código de QR na resposta:', qrResposta.data);
                return false;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    console.error('⏱️  Tempo esgotado esperando conexão. Reinicie o processo pra tentar de novo.');
    return false;
}

async function main() {
    console.log('Iniciando o fluxo principal (via Evolution API)...');

    const conectado = await garantirConectado();
    if (!conectado) {
        console.error('Encerrando — não foi possível confirmar a conexão.');
        return;
    }

    scheduleAdvertisements();
    iniciarServidorTeste();
    await listarGruposDisponiveis();

    console.log('Fluxo principal iniciado com sucesso.');
}

main();
