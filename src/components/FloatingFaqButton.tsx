import React from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FloatingFaqButtonProps {
  role: 'nestle' | 'chilling_center';
}

export default function FloatingFaqButton({ role }: FloatingFaqButtonProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    if (role === 'nestle') {
      navigate('/nestle/support');
    } else {
      navigate('/chilling-center/support');
    }
  };

  return (
    <button
      onClick={handleNavigate}
      className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all z-50 hover:scale-105"
      aria-label="FAQ & Support"
    >
      <MessageCircleQuestion className="w-7 h-7" />
    </button>
  );
}
