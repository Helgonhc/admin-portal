'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft, Printer, Download, Loader2, QrCode } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function EquipmentQRCodePage() {
    const params = useParams();
    const router = useRouter();
    const [equipment, setEquipment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const qrRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadEquipment();
    }, [params.id]);

    async function loadEquipment() {
        try {
            const { data, error } = await supabase
                .from('equipments')
                .select('*, clients(name)')
                .eq('id', params.id)
                .single();

            if (error) throw error;

            // Se não tiver código QR, gerar um baseado no ID (8 primeiros chars)
            if (!data.qr_code || data.qr_code.startsWith('http')) {
                const generatedCode = `EQ-${data.id.substring(0, 8).toUpperCase()}`;
                await supabase
                    .from('equipments')
                    .update({ qr_code: generatedCode })
                    .eq('id', data.id);
                data.qr_code = generatedCode;
            }

            setEquipment(data);
        } catch (error) {
            console.error('Erro:', error);
            toast.error('Equipamento não encontrado');
            router.push('/dashboard/equipments');
        } finally {
            setLoading(false);
        }
    }

    function handlePrint() {
        window.print();
    }

    function handleDownload() {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `qrcode-${equipment.qr_code}.png`;
            link.href = url;
            link.click();
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12 print:bg-white print:pb-0">
            {/* Header - Hidden on print */}
            <div className="bg-white border-b px-4 py-4 print:hidden">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/dashboard/equipments/${params.id}`} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-lg font-bold text-gray-800">Gerar Etiqueta QR</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleDownload} className="btn btn-secondary py-2">
                            <Download size={18} />
                        </button>
                        <button onClick={handlePrint} className="btn btn-primary py-2 px-6">
                            <Printer size={18} /> Imprimir
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-xl mx-auto p-8 print:p-0">
                <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center print:shadow-none print:border-none print:p-4">

                    {/* Brand/Company Header for Label */}
                    <div className="mb-6 border-b pb-4 w-full">
                        <h2 className="text-2xl font-black text-blue-600 tracking-tighter uppercase">Eletricom OS</h2>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Eletricom Manutenção Especializada</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border-2 border-gray-50 print:p-0 print:border-0" ref={qrRef}>
                        <QRCodeCanvas
                            value={equipment.qr_code}
                            size={256}
                            level="H"
                            includeMargin={true}
                            imageSettings={{
                                src: "/logo-eletricom.png", // Nota: Presumindo que você terá um logo novo em breve
                                x: undefined,
                                y: undefined,
                                height: 48,
                                width: 48,
                                excavate: true,
                            }}
                        />
                    </div>

                    <div className="mt-8 space-y-2 w-full">
                        <p className="text-2xl font-bold text-gray-900 leading-tight">{equipment.name}</p>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-gray-500">
                            {equipment.model && <p className="text-sm">Mod: <span className="text-gray-800 font-semibold">{equipment.model}</span></p>}
                            {equipment.brand && <p className="text-sm">Marca: <span className="text-gray-800 font-semibold">{equipment.brand}</span></p>}
                        </div>
                        <div className="pt-4 flex flex-col items-center">
                            <span className="px-4 py-1.5 bg-gray-900 text-white rounded-full text-sm font-mono tracking-widest font-bold">
                                {equipment.qr_code}
                            </span>
                            <p className="mt-4 text-[10px] text-gray-400 font-medium max-w-[200px]">
                                Aponte a câmera para abrir um chamado automático para este equipamento.
                            </p>
                        </div>
                    </div>

                    {/* Footer of Label */}
                    <div className="mt-12 pt-6 border-t border-dashed w-full flex justify-between items-center opacity-50">
                        <div className="text-left">
                            <p className="text-[8px] font-bold uppercase tracking-tighter">Cliente</p>
                            <p className="text-[10px] text-gray-800 font-bold leading-none">{equipment.clients?.name}</p>
                        </div>
                        <QrCode size={24} className="text-gray-300" />
                    </div>
                </div>

                {/* Instructions - Hidden on print */}
                <div className="mt-8 bg-indigo-50 p-6 rounded-2xl border border-indigo-100 print:hidden">
                    <h3 className="text-indigo-900 font-bold mb-2 flex items-center gap-2">
                        <Printer size={16} /> Dica de Impressão
                    </h3>
                    <p className="text-sm text-indigo-700 leading-relaxed">
                        Para melhores resultados em etiquetas de 10x10cm ou 10x15cm, use a função de
                        <strong> Escalar Conteúdo</strong> nas configurações de impressão e selecione
                        <strong> Somente Preto e Branco</strong> para maior contraste.
                    </p>
                </div>
            </div>

            <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .btn, header, footer, nav {
            display: none !important;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>
        </div>
    );
}
