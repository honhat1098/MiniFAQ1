import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';

interface HomeProps {
  onHost: () => void;
  onJoin: () => void;
}

export const Home: React.FC<HomeProps> = ({ onHost, onJoin }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
        Bậc Thầy <br/>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-brand-red">
          Thích ứng & Giải Quyết
        </span>
      </h2>
      <p className="text-xl text-white/80 mb-12 max-w-2xl">
      
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <button 
          onClick={onHost}
          className="group relative bg-white text-brand-dark p-8 rounded-3xl shadow-[0_8px_0_rgb(180,180,180)] active:shadow-none active:translate-y-2 transition-all duration-150 flex flex-col items-center hover:bg-gray-50"
        >
          <div className="bg-brand-purple/10 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform">
            <Monitor className="w-16 h-16 text-brand-purple" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Chủ trì</h3>
          <p className="text-gray-500"></p>
        </button>

        <button 
          onClick={onJoin}
          className="group relative bg-brand-accent text-white p-8 rounded-3xl shadow-[0_8px_0_rgb(11,70,140)] active:shadow-none active:translate-y-2 transition-all duration-150 flex flex-col items-center hover:bg-brand-blue"
        >
          <div className="bg-white/20 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform">
            <Smartphone className="w-16 h-16 text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Người tham gia</h3>
          <p className="text-white/80">Sử dụng điện thoại hoặc máy tính để tham gia.</p>
        </button>
      </div>

      <div className="mt-16 text-sm opacity-50">
        <p>Tip: Open this app in two separate browser tabs to simulate both roles simultaneously!</p>
      </div>
    </div>
  );
};
