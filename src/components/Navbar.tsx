/**
 * Navbar — Swiss × Eastern Whitespace
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi } from 'lucide-react';

interface NavbarProps {
  onNavigate: (section: string) => void;
  currentPage: 'home' | 'demo' | 'floorplan';
  onPageChange: (page: 'home' | 'demo' | 'floorplan') => void;
}

export function Navbar({ onNavigate, currentPage, onPageChange }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: '功能特性', section: 'features' },
    { label: '技术架构', section: 'architecture' },
    { label: '应用场景', section: 'scenarios' },
    { label: '路线图', section: 'roadmap' },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? 'bg-background/80 backdrop-blur-md border-b border-border' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <button onClick={() => onPageChange('home')} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
            <Wifi className="w-4 h-4" style={{ color: 'oklch(0.99 0 0)' }} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Wi-Fi Sense</span>
        </button>

        <div className="flex items-center gap-1">
          {currentPage === 'home' && navLinks.map(link => (
            <button
              key={link.section}
              onClick={() => onNavigate(link.section)}
              className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </button>
          ))}

          {/* 页面切换按钮组 */}
          <div className="flex items-center gap-1 ml-3">
            {currentPage !== 'home' && (
              <button
                onClick={() => onPageChange('home')}
                className="h-8 px-4 text-[13px] rounded-lg border border-foreground/15 hover:bg-foreground/[0.03] transition-all"
              >
                首页
              </button>
            )}
            <button
              onClick={() => onPageChange('demo')}
              className={`h-8 px-4 text-[13px] font-medium rounded-lg transition-all ${
                currentPage === 'demo' ? 'bg-foreground text-background' : 'border border-foreground/15 hover:bg-foreground/[0.03]'
              }`}
            >
              信号演示
            </button>
            <button
              onClick={() => onPageChange('floorplan')}
              className={`h-8 px-4 text-[13px] font-medium rounded-lg transition-all ${
                currentPage === 'floorplan' ? 'bg-foreground text-background' : 'border border-foreground/15 hover:bg-foreground/[0.03]'
              }`}
            >
              户型定位
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
