import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  HardDrive, 
  QrCode, 
  ShieldCheck, 
  Printer, 
  Smartphone, 
  Share2, 
  Lock, 
  Layers 
} from 'lucide-react';
import { StudioProfile } from '../types';

interface HelpAndGuideProps {
  studioProfile: StudioProfile;
}

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export const HelpAndGuide: React.FC<HelpAndGuideProps> = ({ studioProfile }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      category: 'Konsep Multi-User & Google Drive',
      question: 'Apakah foto pelanggan studio saya tersimpan di server developer?',
      answer:
        'TIDAK. GaleriFotoQR menggunakan arsitektur Multi-Tenant independen. Seluruh file foto asli tersimpan langsung di Google Drive akun Google milik studio Anda sendiri. Developer atau studio lain sama sekali tidak memiliki akses ke folder Google Drive Anda.',
    },
    {
      category: 'Konsep Multi-User & Google Drive',
      question: 'Apakah pengguna biasa harus membuat Google Cloud Project atau Client ID?',
      answer:
        'Sama sekali TIDAK. Pengguna hanya perlu menekan tombol "Masuk dengan Google" dan memberikan izin Google Drive. Semua konfigurasi teknis telah disiapkan secara otomatis oleh platform.',
    },
    {
      category: 'Pengiriman QR Code & Galeri Klien',
      question: 'Apakah pelanggan studio harus memiliki akun Google untuk melihat foto?',
      answer:
        'TIDAK PERLU. Pelanggan cukup memindai (scan) QR Code atau membuka tautan galeri yang Anda bagikan. Galeri akan langsung terbuka di browser HP mereka tanpa perlu login apa pun.',
    },
    {
      category: 'Pengiriman QR Code & Galeri Klien',
      question: 'Bagaimana cara terbaik membagikan QR Code pada acara pernikahan atau photobooth?',
      answer:
        'Gunakan fitur "Kartu Cetak / Tent Card" pada menu QR Code. Anda dapat mencetak template kartu meja dengan logo studio, judul acara, dan QR Code untuk diletakkan di photobooth atau meja tamu.',
    },
    {
      category: 'Keamanan & Privasi',
      question: 'Bagaimana cara mengamankan album foto dengan PIN / Password?',
      answer:
        'Saat membuat atau mengedit album, aktifkan opsi "Proteksi Password / PIN Galeri". Masukkan PIN (misal: tanggal acara atau nama panggilan). Pelanggan akan diminta memasukkan PIN sebelum dapat melihat dan mengunduh foto.',
    },
    {
      category: 'Kapasitas & Kuota',
      question: 'Berapa banyak foto yang bisa saya simpan?',
      answer:
        'Kapasitas penyimpanan mengikuti kuota Google Drive Anda (gratis 15 GB atau sesuai paket Google One / Workspace Anda). Jika kuota Google Drive Anda bertambah, kapasitas galeri Anda otomatis mengikuti tanpa biaya tambahan dari kami.',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Pusat Bantuan & Panduan Studio
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Pelajari alur kerja efisien, panduan Google Drive, dan tips pengiriman QR Code galeri pelanggan.
        </p>
      </div>

      {/* 3 Step Workflow Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          Alur Kerja 3 Langkah GaleriFotoQR
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              1
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Buat Album</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Isi nama klien, tanggal acara, dan PIN (opsional). Sistem otomatis membuat folder di Google Drive Anda.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              2
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Unggah Foto</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tarik & letakkan foto hasil jepretan Anda. File otomatis terkompresi cepat dan disimpan di Google Drive.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              3
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Bagikan QR Code</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unduh QR Code atau cetak kartu meja. Pelanggan langsung memindai lewat kamera HP untuk melihat & mendownload.
            </p>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          Pertanyaan yang Sering Diajukan (FAQ)
        </h3>

        <div className="divide-y divide-slate-100">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="py-3">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left gap-3 py-1 cursor-pointer group"
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {faq.question}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed pl-1 pr-4 animate-in fade-in duration-150">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
