import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Milk, Droplets } from 'lucide-react';

const SplashLoader: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [showSubText, setShowSubText] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 4500); // Cinematic duration

    const subTextTimer = setTimeout(() => {
      setShowSubText(true);
    }, 1200);

    return () => {
      clearTimeout(timer);
      clearTimeout(subTextTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden"
    >
      {/* Background Cinematic Particles (subtle) */}
      <motion.div
        className="absolute inset-0 opacity-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 2 }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500 rounded-full blur-[120px]" />
      </motion.div>

      <div className="relative flex flex-col items-center">
        {/* The "Netflix-style" expanding logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, filter: 'blur(20px)' }}
          animate={{
            scale: [0.8, 1.1, 1],
            opacity: 1,
            filter: 'blur(0px)',
            textShadow: [
              "0 0 0px rgba(255,255,255,0)",
              "0 0 40px rgba(59,130,246,0.6)",
              "0 0 20px rgba(59,130,246,0.4)"
            ]
          }}
          transition={{
            duration: 1.5,
            ease: "easeOut",
            times: [0, 0.7, 1]
          }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="p-4 bg-white rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.2)]">
            <Milk className="w-16 h-16 text-black" strokeWidth={2.5} />
          </div>
          <div className="h-16 w-[2px] bg-white/20 mx-2" />
          <Droplets className="w-16 h-16 text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" strokeWidth={2.5} />
        </motion.div>

        <div className="h-12 flex flex-col items-center justify-center">
          <motion.h1
            initial={{ letterSpacing: "0.2em", opacity: 0, y: 10 }}
            animate={{ letterSpacing: "0.05em", opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            className="text-white text-4xl font-display font-black"
          >
            FARM <span className="text-blue-500">X</span> NESTLÉ
          </motion.h1>

          <AnimatePresence>
            {showSubText && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="text-white/40 text-xs mt-4 uppercase tracking-[0.4em] font-medium"
              >
                Dairy Supply Chain Evolution
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Cinematic Flare effect */}
        <motion.div
          animate={{
            x: ['-200%', '200%'],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            repeatDelay: 0.5,
            ease: "easeInOut"
          }}
          className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent blur-sm"
        />
      </div>

      {/* Screen flash on end */}
      <motion.div
        className="absolute inset-0 bg-white pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0] }}
        transition={{ duration: 4.5, times: [0, 0.8, 0.9, 1] }}
      />
    </motion.div>
  );
};

export default SplashLoader;
