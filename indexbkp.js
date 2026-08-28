const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode-terminal');

// ─── Configuração da Evolution API ─────────────────────────────────────
const EVOLUTION_URL = 'http://localhost:8082';
const EVOLUTION_APIKEY = '429683C4C977415CAAFCCE10F7D57E11'; // troque pela sua chave, se gerou uma própria
const EVOLUTION_INSTANCE = 'teste-anuncios'; // nome da instância que você já criou e conectou

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

// Mínimo de mensagens de OUTRAS pessoas (não do bot) que precisam ter
// chegado num grupo desde o último anúncio, pra considerar ele "ativo o
// suficiente" e enviar de novo. Grupo abaixo disso é pulado nessa rodada.
const MENSAGENS_MINIMAS_ENTRE_ENVIOS = 5;

// Guarda, por grupo, o timestamp do nosso último envio — usado pra saber
// a partir de quando contar mensagens novas. Persiste em arquivo, pra
// sobreviver a um restart do bot (senão, reiniciar "zeraria" a memória
// e voltaria a enviar pra todo mundo na próxima rodada).
const ARQUIVO_ULTIMO_ENVIO = path.resolve(__dirname, 'ultimo_envio.json');

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

// Conta quantas mensagens de OUTRAS pessoas (fromMe: false) chegaram
// nesse grupo depois do timestamp informado. Se nunca enviamos pra esse
// grupo antes (sem timestamp registrado), considera "ativo o suficiente"
// por padrão — não faz sentido bloquear o primeiríssimo envio.
async function contarMensagensNovasDesde(grupoId, timestampUltimoEnvio) {
    if (!timestampUltimoEnvio) return MENSAGENS_MINIMAS_ENTRE_ENVIOS; // libera o primeiro envio

    try {
        const resposta = await evolutionApi.post(`/chat/findMessages/${EVOLUTION_INSTANCE}`, {
            where: { key: { remoteJid: grupoId } },
        });

        const mensagens = Array.isArray(resposta.data) ? resposta.data : resposta.data?.messages || [];

        const novasDeOutros = mensagens.filter((m) => {
            const timestamp = m.messageTimestamp || m.message_timestamp;
            const deOutraPessoa = m.key?.fromMe === false || m.fromMe === false;
            return deOutraPessoa && timestamp > timestampUltimoEnvio;
        });

        return novasDeOutros.length;
    } catch (error) {
        console.error(`Erro ao contar mensagens do grupo ${grupoId}:`, error.response?.data || error.message);
        // Em caso de erro na consulta, libera o envio — melhor mandar a
        // mais do que travar o grupo indefinidamente por causa de um bug
        return MENSAGENS_MINIMAS_ENTRE_ENVIOS;
    }
}

// ─── Descoberta de grupos — agora é só perguntar direto pra API, sem
// precisar escutar mensagem nenhuma. Roda uma vez, salva num arquivo,
// pra você consultar quando quiser adicionar um grupo novo na lista acima.
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

// ─── Envio em si — converte a imagem do dia pra base64 e manda pra cada
// grupo via Evolution API. Mesma lógica de antes, só trocando o "como
// envia" (API HTTP em vez de Puppeteer/Chrome controlando o WhatsApp Web).
async function enviarAnuncioParaTodosGrupos(diaAtual) {
    const imagens = [
        './diaum.jpg',
        './diadois.jpg',
        './diatres.jpg',
        './diaquatro.jpg',
        './diacinco.jpg',
        './diaseis.jpg'
    ];

    const caminhoImagem = imagens[diaAtual - 1];

    if (!caminhoImagem || !fs.existsSync(caminhoImagem)) {
        const erro = `Arquivo de imagem não encontrado pro dia ${diaAtual}: ${caminhoImagem}`;
        console.error(erro);
        return { sucesso: false, erro };
    }

    const mensagem = '🍽️ CHEGA DE PAGAR COMISSÃO PRO APP DE ENTREGA! 🚀\n\nVocê tem restaurante, hamburgueria, pizzaria ou delivery e quer vender mais sem perder dinheiro com comissão? Conheça o Eu Cardápio! 👇\n\n✅ Cardápio digital com a cara do seu negócio\n✅ Pedido automático pelo WhatsApp\n✅ Pagamento direto na SUA conta (Pix, cartão)\n✅ QR Code pra pedido na mesa\n✅ Cupom e cashback pra cliente sempre voltar\n✅ Painel completo de gestão, tudo numa tela só\n\n💰 Assinatura fixa — sem comissão nenhuma por pedido!\n\n📲 Teste grátis por 7 dias, sem cartão de crédito\n👇🏼 Veja como funciona:\nhttps://portal.eucardapio.com.br';

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
                fileName: `anuncio.${extensao}`,
            });
            console.log(`Mensagem enviada para o grupo: ${grupo} (${mensagensNovas} mensagens novas desde o último envio)`);
            resultados.push({ grupo, sucesso: true });

            // Atualiza o marcador desse grupo pro momento atual — só depois
            // de mandar de verdade, senão perderíamos a contagem acumulada
            // dos grupos que ficaram pulados nessa rodada
            ultimoEnvio[grupo] = Math.floor(Date.now() / 1000);
            salvarUltimoEnvioPorGrupo(ultimoEnvio);

            // Pequeno intervalo entre envios — reduz a chance de o WhatsApp
            // marcar como comportamento automatizado suspeito
            await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
            const detalhe = error.response?.data || error.message;
            console.error(`Erro ao enviar mensagem para o grupo ${grupo}:`, detalhe);
            resultados.push({ grupo, sucesso: false, erro: detalhe });
        }
    }
    return { sucesso: true, resultados };
}

// O servidor roda em UTC (confirmado com `date` na VPS) — sem essa
// correção, tanto a hora quanto o dia (perto da virada, entre 21h e
// meia-noite em Brasília) ficariam errados em relação ao horário real
// de Brasília. Usada tanto pelo agendamento quanto pela rota de teste,
// pra nunca corrigir um lugar e esquecer o outro.
function getHoraEDiaBrasilia() {
    const agora = new Date();
    const horaUTC = agora.getUTCHours();
    const horaBrasilia = (horaUTC + 24 - 3) % 24;

    // Se a correção "voltou" a hora pro dia anterior (ex: 1h UTC vira 22h
    // do dia anterior em Brasília), o dia da semana também precisa voltar
    const viraDia = horaUTC < 3;
    const diaUTC = agora.getUTCDay();
    const diaBrasilia = viraDia ? (diaUTC + 6) % 7 : diaUTC;

    return { horaAtual: horaBrasilia, diaAtual: diaBrasilia };
}

function scheduleAdvertisements() {
    cron.schedule('0 * * * *', async () => {
        console.log('Pronto para enviar anúncios...');

        const { horaAtual, diaAtual } = getHoraEDiaBrasilia();

        if (diaAtual >= 1 && diaAtual <= 6 && horarios.includes(horaAtual)) {
            await enviarAnuncioParaTodosGrupos(diaAtual);
        }
    });
    console.log('📅 Agendamento de anúncios ativo.');
}

// ─── Servidor HTTP mínimo, só pra testar envio na hora, sem esperar o
// cron — e também pra listar os grupos disponíveis quando precisar.
// Escuta só em localhost, não fica exposto pra fora da VPS.
function iniciarServidorTeste() {
    const app = express();
    const PORTA_TESTE = 3999;

    app.get('/testar-envio', async (req, res) => {
        const { diaAtual } = getHoraEDiaBrasilia();
        if (diaAtual === 0) {
            return res.status(400).json({ sucesso: false, erro: 'Hoje é domingo, não tem anúncio configurado pra esse dia.' });
        }
        console.log(`🧪 Teste manual disparado via rota HTTP — dia ${diaAtual}`);
        const resultado = await enviarAnuncioParaTodosGrupos(diaAtual);
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

// Se a instância não estiver conectada, busca o QR Code e desenha no
// terminal — igual ao comportamento que já era automático no
// whatsapp-web.js. Confere de novo a cada 5s, até conectar ou desistir
// depois de um tempo.
async function garantirConectado() {
    for (let tentativa = 1; tentativa <= 24; tentativa++) { // ~2 minutos no total
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

// ─── Início ─────────────────────────────────────────────────────────────
async function main() {
    console.log('Iniciando o fluxo principal (via Evolution API)...');

    const conectado = await garantirConectado();
    if (!conectado) {
        console.error('Encerrando — não foi possível confirmar a conexão.');
        return;
    }

    scheduleAdvertisements();
    iniciarServidorTeste();

    // Lista os grupos automaticamente ao conectar, salvando em
    // grupos_disponiveis.txt — sem precisar chamar a rota manualmente
    await listarGruposDisponiveis();

    console.log('Fluxo principal iniciado com sucesso.');
}

main(); 

