import React, { useState } from 'react';
import { 
    X, Sparkles, Heart, Bookmark, Star, Gift, 
    Check, ArrowRight, Shield, Coffee, UserCheck
} from 'lucide-react';

export default function AuthPromptModal({ isOpen, onClose, triggerType = 'favorite', onLoginSuccess }) {
    const [activeTab, setActiveTab] = useState('signup'); // 'signup' | 'login'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    // Custom titles & descriptions depending on what feature triggered the modal
    const getTriggerInfo = () => {
        switch (triggerType) {
            case 'favorite':
                return {
                    icon: <Heart className="w-8 h-8 text-rose-500 fill-rose-500/20" />,
                    title: "Save Your Favorite Coffee Spots!",
                    subtitle: "Bookmark hidden gems, craft your personal cafe list, and sync across all your devices.",
                    badge: "Member-Only Feature"
                };
            case 'route':
                return {
                    icon: <Bookmark className="w-8 h-8 text-amber-400 fill-amber-400/20" />,
                    title: "Save Custom Coffee Walks & Routes",
                    subtitle: "Save your favorite walking routes, share cafe tours with friends, and get offline navigation.",
                    badge: "Pro Routing Feature"
                };
            case 'review':
                return {
                    icon: <Star className="w-8 h-8 text-yellow-400 fill-yellow-400/20" />,
                    title: "Join the Coffee Connoisseur Community",
                    subtitle: "Rate espresso quality, upload latte art photos, and leave reviews for local baristas.",
                    badge: "Community Feature"
                };
            case 'perk':
                return {
                    icon: <Gift className="w-8 h-8 text-emerald-400 fill-emerald-400/20" />,
                    title: "Claim Exclusive Barista Discounts",
                    subtitle: "Unlock 15% off first brew, free roast samples, and VIP loyalty rewards at partner cafes.",
                    badge: "Exclusive Member Reward"
                };
            default:
                return {
                    icon: <Sparkles className="w-8 h-8 text-amber-500" />,
                    title: "Unlock Full RoastRoute Features",
                    subtitle: "Create your free account today and discover the ultimate coffee shop companion.",
                    badge: "RoastRoute Access"
                };
        }
    };

    const triggerInfo = getTriggerInfo();

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);

        setTimeout(() => {
            const userObj = {
                id: Date.now(),
                name: name.trim() || (activeTab === 'signup' ? 'Coffee Lover' : 'Bean Explorer'),
                email: email.trim() || 'user@roastroute.app',
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email || name || 'coffee')}`
            };

            // Store in LocalStorage
            localStorage.setItem('roastroute_mock_user', JSON.stringify(userObj));
            
            setLoading(false);
            onLoginSuccess(userObj);
            onClose();
        }, 600);
    };

    const handleQuickDemoUser = () => {
        setLoading(true);
        setTimeout(() => {
            const demoUser = {
                id: 999,
                name: "Espresso Enthusiast",
                email: "demo@roastroute.app",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Espresso"
            };
            localStorage.setItem('roastroute_mock_user', JSON.stringify(demoUser));
            setLoading(false);
            onLoginSuccess(demoUser);
            onClose();
        }, 400);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            {/* Modal Box */}
            <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100 transform transition-all">
                
                {/* Top Glowing Header Banner */}
                <div className="relative p-6 bg-gradient-to-br from-amber-950/60 via-zinc-900 to-zinc-950 border-b border-zinc-800/80">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-zinc-900/90 border border-zinc-700/60 rounded-2xl shadow-inner">
                            {triggerInfo.icon}
                        </div>
                        <div>
                            <span className="inline-block px-2.5 py-0.5 mb-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full uppercase tracking-wider">
                                {triggerInfo.badge}
                            </span>
                            <h3 className="text-xl font-extrabold text-white">
                                {triggerInfo.title}
                            </h3>
                        </div>
                    </div>
                    
                    <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                        {triggerInfo.subtitle}
                    </p>
                </div>

                {/* Body Content & Form */}
                <div className="p-6 space-y-5">
                    
                    {/* Benefits bullet points */}
                    <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-zinc-950/60 rounded-2xl border border-zinc-800/50 text-xs">
                        <div className="flex items-center gap-2 text-zinc-300">
                            <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span>Unlimited Cafe Saves</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300">
                            <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span>Personalized Recommendations</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300">
                            <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span>Offline Cafe Maps</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300">
                            <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span>Barista Perks & Coupons</span>
                        </div>
                    </div>

                    {/* Tab Selection */}
                    <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                        <button
                            type="button"
                            onClick={() => setActiveTab('signup')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                activeTab === 'signup' 
                                    ? 'bg-amber-500 text-zinc-950 shadow-md' 
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Create Free Account
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('login')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                activeTab === 'login' 
                                    ? 'bg-amber-500 text-zinc-950 shadow-md' 
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Log In
                        </button>
                    </div>

                    {/* Auth Form */}
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        {activeTab === 'signup' && (
                            <div>
                                <label className="block mb-1 text-xs font-semibold text-zinc-300">Your Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Alex Barista"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block mb-1 text-xs font-semibold text-zinc-300">Email Address</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block mb-1 text-xs font-semibold text-zinc-300">Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>{activeTab === 'signup' ? 'Create Free Account & Continue' : 'Sign In & Unlock Feature'}</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Quick Demo Access Button */}
                    <div className="pt-2 border-t border-zinc-800/60 text-center">
                        <button
                            type="button"
                            onClick={handleQuickDemoUser}
                            className="text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5"
                        >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Or click here for <strong>Instant Demo Login</strong> (1-click)</span>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
