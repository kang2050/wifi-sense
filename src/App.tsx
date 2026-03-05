import { useState, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { DemoPage } from './pages/DemoPage';
import { FloorPlanPage } from './pages/FloorPlanPage';

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'demo' | 'floorplan'>('home');

  const sectionRefs = {
    features: useRef<HTMLElement>(null),
    architecture: useRef<HTMLElement>(null),
    scenarios: useRef<HTMLElement>(null),
    roadmap: useRef<HTMLElement>(null),
  };

  const handleNavigate = (section: string) => {
    if (currentPage !== 'home') {
      setCurrentPage('home');
      setTimeout(() => {
        const ref = sectionRefs[section as keyof typeof sectionRefs];
        ref?.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const ref = sectionRefs[section as keyof typeof sectionRefs];
      ref?.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePageChange = (page: 'home' | 'demo' | 'floorplan') => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        onNavigate={handleNavigate}
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />
      {currentPage === 'home' && (
        <HomePage
          onDemo={() => handlePageChange('demo')}
          sectionRefs={sectionRefs}
        />
      )}
      {currentPage === 'demo' && <DemoPage />}
      {currentPage === 'floorplan' && <FloorPlanPage />}
    </div>
  );
}

export default App;
