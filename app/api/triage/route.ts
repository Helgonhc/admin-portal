import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase configuration missing');
    return createClient(url, key);
};

export async function POST(req: Request) {
    const { ticketId, title, description } = await req.json();
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    if (!ticketId || !title) {
        return NextResponse.json({ error: 'ID e Título do ticket são obrigatórios.' }, { status: 400 });
    }

    const prompt = `
        Você é um assistente especializado em triagem de chamados de manutenção elétrica e climatização para a empresa Eletricom.
        Sua tarefa é analisar o título e a descrição de um chamado e sugerir:
        1. Prioridade (baixa, media, alta, urgente).
        2. Categoria (Elétrica, Ar Condicionado, Preventiva, Corretiva, Outros).
        3. Justificativa curta para a prioridade.

        Chamado:
        Título: ${title}
        Descrição: ${description}

        Responda APENAS em formato JSON puro, sem blocos de código markdown, exatamente assim:
        {
            "priority": "prioridade_aqui",
            "category": "categoria_here",
            "justification": "justificativa_aqui"
        }
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error('Falha na resposta da IA');

        const suggestion = JSON.parse(text);

        // Atualizar o ticket no banco
        const supabase = getSupabaseAdmin();
        const { error: updateError } = await supabase
            .from('tickets')
            .update({ ai_suggestion: suggestion })
            .eq('id', ticketId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, suggestion });

    } catch (error: any) {
        console.error('Triage AI Error:', error);
        return NextResponse.json({ error: 'Erro ao processar triagem: ' + error.message }, { status: 500 });
    }
}
