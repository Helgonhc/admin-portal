import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Log para depuração (pode remover depois)
        console.log('Webhook WhatsApp Recebido:', JSON.stringify(body, null, 2));

        // A Evolution API manda vários tipos de eventos. O principal de mensagem é MESSAGES_UPSERT
        if (body.event !== 'MESSAGES_UPSERT') {
            return NextResponse.json({ received: true, ignored: true });
        }

        const messageData = body.data;
        const isFromMe = messageData.key.fromMe;

        // Ignorar mensagens enviadas por mim mesmo para não criar tickets infinitos
        if (isFromMe) {
            return NextResponse.json({ received: true, ignored: true });
        }

        const remoteJid = messageData.key.remoteJid; // ex: 5531993338026@s.whatsapp.net
        if (remoteJid.includes('@g.us')) {
            // Ignorar grupos por enquanto (opcional)
            return NextResponse.json({ received: true, ignored: true });
        }

        const phoneNumber = remoteJid.split('@')[0];
        const messageText = messageData.message?.conversation ||
            messageData.message?.extendedTextMessage?.text ||
            'Mensagem de mídia/arquivo';

        // 1. Tentar encontrar o cliente pelo número de telefone
        // Tentamos buscar com o DDI (55) e talvez sem (depende de como está salvo no banco)
        let { data: client, error: clientError } = await supabaseAdmin
            .from('clients')
            .select('id, name')
            .or(`phone.ilike.%${phoneNumber}%,phone.ilike.%${phoneNumber.substring(2)}%`)
            .maybeSingle();

        if (!client) {
            console.log(`Cliente com número ${phoneNumber} não encontrado.`);
            // Opcional: Criar um ticket "Prospect" ou logar apenas
            // Por enquanto, vamos criar para um cliente Genérico ou apenas ignorar
            return NextResponse.json({ received: true, clientNotFound: true });
        }

        // 2. Verificar se este cliente já tem um ticket "aberto"
        const { data: existingTicket } = await supabaseAdmin
            .from('tickets')
            .select('id, ticket_number')
            .eq('client_id', client.id)
            .eq('status', 'aberto')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let ticketId;

        if (existingTicket) {
            ticketId = existingTicket.id;
        } else {
            // 3. Criar novo ticket se não houver um aberto
            const { data: newTicket, error: ticketError } = await supabaseAdmin
                .from('tickets')
                .insert([{
                    client_id: client.id,
                    title: 'Chamado via WhatsApp',
                    description: messageText,
                    status: 'aberto',
                    priority: 'media',
                    source: 'whatsapp'
                }])
                .select()
                .single();

            if (ticketError) throw ticketError;
            ticketId = newTicket.id;
        }

        // 4. Inserir a mensagem no histórico do ticket
        const { error: messageError } = await supabaseAdmin
            .from('ticket_messages')
            .insert([{
                ticket_id: ticketId,
                message: messageText,
                is_internal: false
                // sender_id será null pois vem de fora, ou você pode associar a um perfil
            }]);

        if (messageError) throw messageError;

        return NextResponse.json({
            success: true,
            ticketId,
            clientId: client.id
        });

    } catch (error: any) {
        console.error('Erro no Webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
