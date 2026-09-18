import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { setAdminToken } from '../lib/auth';

export default function OwnerActivationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Activation de votre espace propriétaire…');

  useEffect(() => {
    const clean = token.trim();
    if (!clean || clean.length < 20) {
      setMessage('Lien d’activation invalide.');
      return;
    }

    setAdminToken(clean);
    window.localStorage.setItem('anbaybot_owner_activated_at', new Date().toISOString());
    setMessage('Espace propriétaire activé sur cet appareil.');

    const timer = window.setTimeout(() => {
      navigate('/setup', { replace: true });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [token, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card p-8 max-w-lg w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-600/15 flex items-center justify-center mx-auto mb-4">
          {message.startsWith('Espace') ? <CheckCircle2 size={28} className="text-brand-400" /> : <KeyRound size={28} className="text-brand-400" />}
        </div>
        <h1 className="text-xl font-semibold text-white">Activation propriétaire</h1>
        <p className="text-sm text-surface-400 mt-3">{message}</p>
        <p className="text-xs text-surface-500 mt-3">Le secret reste uniquement dans le stockage local de ce navigateur et n’est pas ajouté au code public.</p>
      </div>
    </div>
  );
}
