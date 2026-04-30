import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { CarFront, CheckCircle, Image as ImageIcon, LogIn, MessageSquare, Plus, Search, Send, User, CalendarDays, ClipboardList, ShieldCheck, LogOut, X, Delete, Camera, Baby, Store, Book, Upload, ExternalLink, Settings, Trash2 } from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'k-car-mobile';

// TWS Members
const MEMBERS = ['SHINYU', 'DOHOON', 'YOUNGJAE', 'HANJIN', 'JIHOON', 'KYUNGMIN'];

const MEMBER_ZH = {
  'SHINYU': '申惟',
  'DOHOON': '道勳',
  'YOUNGJAE': '英宰',
  'HANJIN': '韓振',
  'JIHOON': '志薰',
  'KYUNGMIN': '炅潣'
};

const SORT_ORDER = ['SHINYU', 'DOHOON', 'YOUNGJAE', 'HANJIN', 'JIHOON', 'KYUNGMIN'];

const ADMIN_PASS = "840505";

// 莫蘭迪色調 15 色
const MORANDI_COLORS = [
  '#B0C4DE', '#C8C6C6', '#DCD3B6', '#E1C6C6', '#C1C9C4',
  '#B9C2B9', '#9AB4CD', '#A1A8B2', '#B5A8A6', '#D1BFAE',
  '#C4B7B7', '#8CA3A3', '#95A5A6', '#D5D5D5', '#B3B8A4'
];

// --- Utility to compress images ---
const compressImage = (file, maxWidth = 600) => {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleSize = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cars, setCars] = useState([]);
  const [wishlists, setWishlists] = useState([]);
  const [babyPhotos, setBabyPhotos] = useState({});
  const [binders, setBinders] = useState([]);
  const [cardsData, setCardsData] = useState([]);
  const [currentView, setCurrentView] = useState('list');
  const [selectedCar, setSelectedCar] = useState(null);
  const [selectedBinder, setSelectedBinder] = useState(null);
  const [isSimulatedLogin, setIsSimulatedLogin] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [adminLoginModal, setAdminLoginModal] = useState(false);
  
  // Data passed from Wishlist to Create Car
  const [initCarData, setInitCarData] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Auth Error:', error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setIsSimulatedLogin(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to Cars
    const carsRef = collection(db, 'artifacts', appId, 'public', 'data', 'cars');
    const unsubscribeCars = onSnapshot(carsRef, (snapshot) => {
      const carsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      carsData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setCars(carsData);
      
      if (selectedCar) {
        const updatedSelectedCar = carsData.find(c => c.id === selectedCar.id);
        if (updatedSelectedCar) setSelectedCar(updatedSelectedCar);
      }
    }, (error) => console.error("Cars fetch error:", error));

    // Listen to Wishlists
    const wishRef = collection(db, 'artifacts', appId, 'public', 'data', 'wishlists');
    const unsubscribeWish = onSnapshot(wishRef, (snapshot) => {
      const wishesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      wishesData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setWishlists(wishesData);
    }, (error) => console.error("Wishlists fetch error:", error));

    // Listen to Baby Photos
    const babyRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'babyPhotos');
    const unsubscribeBaby = onSnapshot(babyRef, (snapshot) => {
      if (snapshot.exists()) setBabyPhotos(snapshot.data());
    });

    // Listen to Binders (Private Data)
    const bindersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'binders');
    const unsubscribeBinders = onSnapshot(bindersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by custom order, fallback to createdAt
      data.sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });
      setBinders(data);
    });

    // Listen to Cards (Private Data)
    const cardsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'cards');
    const unsubscribeCards = onSnapshot(cardsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });
      setCardsData(data);
    });

    return () => {
      unsubscribeCars();
      unsubscribeWish();
      unsubscribeBaby();
      unsubscribeBinders();
      unsubscribeCards();
    };
  }, [user, selectedCar?.id]); 

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const startCarFromWish = (wish) => {
    setInitCarData({ title: wish.carTitle, picBase64: wish.wishPic });
    setCurrentView('create');
  };

  if (!isSimulatedLogin) {
    return (
      <div className="min-h-screen bg-[#FDF9F7] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[40px] shadow-xl max-w-sm w-full text-center">
          <div className="w-24 h-24 bg-[#78B0CF] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CarFront className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-800 mb-2 tracking-tight">K-car</h1>
          <p className="text-gray-400 mb-10 font-medium tracking-wide">您的專屬拼車空間</p>
          <button 
            onClick={() => setIsSimulatedLogin(true)}
            className="w-full bg-black text-[#78B0CF] font-black py-5 rounded-3xl flex items-center justify-center transition-all active:scale-95 shadow-lg"
          >
            <LogIn className="mr-3" />
            使用 Google 帳號登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcf7f5] text-gray-800 font-sans pb-28">
      {toastMessage && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-white text-gray-900 border border-gray-100 px-8 py-4 rounded-full shadow-2xl z-[100] flex items-center animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-5 h-5 mr-3 text-[#78B0CF]" />
          <span className="font-bold whitespace-nowrap">{toastMessage}</span>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentView('list'); setSelectedCar(null); }}>
          <div className="w-10 h-10 bg-[#78B0CF] rounded-xl flex items-center justify-center shadow-sm">
            <CarFront size={24} className="text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight">K-car</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('my')} className="text-gray-400 font-bold text-sm hover:text-gray-800 transition-colors">我的拼車</button>
          <button onClick={() => setCurrentView('binder')} className="text-gray-400 font-bold text-sm hover:text-gray-800 transition-colors">我的卡冊</button>
          {!isAdmin ? (
            <ShieldCheck size={24} className="text-gray-200 cursor-pointer hover:text-gray-400" onClick={() => setAdminLoginModal(true)} />
          ) : (
            <div className="flex items-center gap-3">
               <button onClick={() => setCurrentView('nursery')} className="text-[#78B0CF] font-black text-sm">託嬰中心</button>
               <LogOut size={22} className="text-red-300 cursor-pointer" onClick={() => setIsAdmin(false)} />
            </div>
          )}
        </div>
      </header>

      <main className="px-6 py-6 max-w-lg mx-auto relative min-h-[80vh]">
        {currentView === 'list' && <CarListView cars={cars} onViewDetail={(car) => { setSelectedCar(car); setCurrentView('detail'); }} />}
        {currentView === 'my' && <MyJoinedCarsView cars={cars} user={user} onViewDetail={(car) => { setSelectedCar(car); setCurrentView('detail'); }} />}
        {currentView === 'detail' && selectedCar && <CarDetailView car={selectedCar} user={user} db={db} appId={appId} binders={binders} babyPhotos={babyPhotos} onBack={() => setCurrentView('list')} showToast={showToast} isAdmin={isAdmin} cars={cars} />}
        {isAdmin && currentView === 'create' && <CreateCarView user={user} db={db} appId={appId} cars={cars} initData={initCarData} clearInitData={() => setInitCarData(null)} onCreated={(car) => { setSelectedCar(car); setCurrentView('detail'); showToast('成功開車！'); }} />}
        {currentView === 'wishlist' && <WishlistView wishlists={wishlists} user={user} db={db} appId={appId} showToast={showToast} isAdmin={isAdmin} onStartCar={startCarFromWish} />}
        {isAdmin && currentView === 'nursery' && <NurseryView db={db} appId={appId} babyPhotos={babyPhotos} showToast={showToast} />}
        {currentView === 'binder' && <BinderListView binders={binders} user={user} db={db} appId={appId} onSelect={(b) => { setSelectedBinder(b); setCurrentView('binderDetail'); }} showToast={showToast} />}
        {currentView === 'binderDetail' && selectedBinder && <BinderDetailView binder={selectedBinder} cards={cardsData.filter(c => c.binderId === selectedBinder.id)} user={user} db={db} appId={appId} onBack={() => setCurrentView('binder')} showToast={showToast} onDelete={() => { setCurrentView('binder'); setSelectedBinder(null); }} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-8 py-4 flex justify-between items-center z-40 shadow-[0_-5px_25px_rgba(0,0,0,0.03)]">
        <button onClick={() => setCurrentView('list')} className={`flex flex-col items-center gap-1 ${currentView === 'list' || currentView === 'detail' ? 'text-[#78B0CF]' : 'text-gray-300'}`}>
          <CarFront size={24} />
          <span className="text-[10px] font-black">拼車列表</span>
        </button>
        <button onClick={() => setCurrentView('wishlist')} className={`flex flex-col items-center gap-1 ${currentView === 'wishlist' ? 'text-[#78B0CF]' : 'text-gray-300'}`}>
          <MessageSquare size={24} />
          <span className="text-[10px] font-black">許願池</span>
        </button>
        <button onClick={() => setCurrentView('binder')} className={`flex flex-col items-center gap-1 ${currentView === 'binder' || currentView === 'binderDetail' ? 'text-[#78B0CF]' : 'text-gray-300'}`}>
          <Book size={24} />
          <span className="text-[10px] font-black">我的卡冊</span>
        </button>
        {isAdmin && (
          <button onClick={() => { setInitCarData(null); setCurrentView('create'); }} className={`flex flex-col items-center gap-1 ${currentView === 'create' ? 'text-[#78B0CF]' : 'text-gray-300'}`}>
            <Plus size={24} />
            <span className="text-[10px] font-black">開新車</span>
          </button>
        )}
      </nav>

      {adminLoginModal && (
        <AdminPinPad 
          onClose={() => setAdminLoginModal(false)} 
          onSuccess={() => { setIsAdmin(true); setAdminLoginModal(false); showToast("管理員已登入"); }}
        />
      )}
    </div>
  );
}

// --- Admin Pin Pad ---
function AdminPinPad({ onClose, onSuccess }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handlePress = (num) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 6) {
        if (newPin === ADMIN_PASS) {
          onSuccess();
        } else {
          setError(true);
          setTimeout(() => { setPin(""); setError(false); }, 1000);
        }
      }
    }
  };

  const handleBackspace = () => setPin(pin.slice(0, -1));

  return (
    <div className="fixed inset-0 bg-[#0F2537]/95 z-50 flex items-center justify-center backdrop-blur-xl">
      <div className="w-full max-w-xs flex flex-col items-center">
        <div className="w-16 h-16 bg-[#78B0CF]/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_15px_#78B0CF40]">
          <ShieldCheck className="text-[#78B0CF]" size={32} />
        </div>
        <h3 className="text-white text-2xl font-black mb-8 tracking-tight">管理員驗證</h3>
        
        <div className={`flex gap-4 mb-12 ${error ? 'animate-shake' : ''}`}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 border-[#78B0CF]/50 transition-all duration-200 ${i < pin.length ? 'bg-[#78B0CF] border-[#78B0CF] scale-110 shadow-[0_0_15px_#78B0CF]' : 'bg-transparent'}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handlePress(num)} className="w-16 h-16 rounded-full bg-[#1A3B5C] text-white text-2xl font-bold flex items-center justify-center hover:bg-[#2A4D73] active:bg-[#78B0CF] active:text-[#0F2537] transition-colors shadow-sm">{num}</button>
          ))}
          <button onClick={onClose} className="w-16 h-16 rounded-full flex items-center justify-center text-[#78B0CF]/70 font-bold hover:text-[#78B0CF] transition-colors">取消</button>
          <button onClick={() => handlePress(0)} className="w-16 h-16 rounded-full bg-[#1A3B5C] text-white text-2xl font-bold flex items-center justify-center hover:bg-[#2A4D73] active:bg-[#78B0CF] active:text-[#0F2537] transition-colors shadow-sm">0</button>
          <button onClick={handleBackspace} className="w-16 h-16 rounded-full flex items-center justify-center text-[#78B0CF] hover:text-white active:text-red-400 transition-colors"><Delete /></button>
        </div>
      </div>
      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 3; }
      `}</style>
    </div>
  );
}

// --- Image Cropper Modal ---
function ImageCropperModal({ file, onCrop, onCancel }) {
  const [src, setSrc] = useState(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const imgRef = useRef(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handleSave = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300; 
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#fff'; 
    ctx.fillRect(0, 0, 300, 300);
    
    const img = imgRef.current;
    if (!img) return;

    // Center and apply offsets
    ctx.translate(150 + offsetX, 150 + offsetY);
    
    // Math to emulate CSS object-fit: contain scale
    const ratio = Math.min(300 / img.naturalWidth, 300 / img.naturalHeight);
    const w = img.naturalWidth * ratio * scale;
    const h = img.naturalHeight * ratio * scale;
    
    // Draw centered
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    
    onCrop(canvas.toDataURL('image/jpeg', 0.8));
  };

  if (!src) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center p-6 backdrop-blur-md">
       <div className="w-full max-w-sm bg-white rounded-[40px] p-8 shadow-2xl">
          <h3 className="text-xl font-black mb-6 text-center text-gray-800">調整寶寶大頭照</h3>
          
          <div className="w-[250px] h-[250px] mx-auto bg-gray-100 rounded-full overflow-hidden relative mb-8 border-4 border-[#78B0CF]/20">
             <img 
               ref={imgRef}
               src={src} 
               alt="preview"
               className="absolute top-1/2 left-1/2 origin-center"
               style={{
                 transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`,
                 maxWidth: '100%',
                 maxHeight: '100%',
                 objectFit: 'contain'
               }}
             />
          </div>

          <div className="space-y-5 mb-8">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-gray-400 w-10">縮放</span>
              <input type="range" min="1" max="3" step="0.1" value={scale} onChange={e => setScale(Number(e.target.value))} className="flex-1 accent-[#78B0CF]" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-gray-400 w-10">左右</span>
              <input type="range" min="-150" max="150" step="1" value={offsetX} onChange={e => setOffsetX(Number(e.target.value))} className="flex-1 accent-[#78B0CF]" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-gray-400 w-10">上下</span>
              <input type="range" min="-150" max="150" step="1" value={offsetY} onChange={e => setOffsetY(Number(e.target.value))} className="flex-1 accent-[#78B0CF]" />
            </div>
          </div>

          <div className="flex gap-3">
             <button onClick={onCancel} className="flex-1 py-4 text-gray-400 font-bold bg-gray-50 rounded-[20px]">取消</button>
             <button onClick={handleSave} className="flex-1 py-4 bg-[#78B0CF] text-white font-black rounded-[20px] shadow-lg">確認裁切</button>
          </div>
       </div>
    </div>
  );
}

// --- List View ---
function CarListView({ cars, onViewDetail }) {
  if (cars.length === 0) return <div className="text-center py-40 opacity-20 font-black text-xl italic">Waiting for new cars...</div>;
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-black mb-2 tracking-tight">拼車列表</h2>
      {cars.map((car) => {
        const allSlots = car.isCustomMode ? (car.customMembers || []) : [...MEMBERS, ...(car.customMembers || [])];
        const filled = allSlots.filter(m => car.members?.[m]).length;
        const total = allSlots.length;

        return (
          <div key={car.id} onClick={() => onViewDetail(car)} className="bg-white rounded-[35px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-gray-50 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden">
            {car.channel && (
              <div className="absolute top-0 right-0 bg-[#78B0CF]/10 text-[#78B0CF] text-[10px] font-black px-4 py-2 rounded-bl-2xl uppercase tracking-widest">
                {car.channel}
              </div>
            )}
            <div className="flex justify-between items-start mb-5 pr-16">
              <div>
                 <h3 className="text-xl font-black text-gray-800 mb-1">{car.carTitle || '未命名拼車'}</h3>
                 <span className="bg-[#FAF6F4] text-[#78B0CF] font-black px-3 py-1 rounded-lg text-xs uppercase">{car.carNumber || 1} 號車</span>
              </div>
            </div>
            <div className="flex justify-between items-end mb-6">
              <div className="space-y-3 font-bold text-gray-400 text-sm">
                <div className="flex items-center gap-2"><User size={14} /> 車主: {car.hostName}</div>
                <div className="flex items-center gap-2 text-red-300"><CalendarDays size={14} /> 截止: {car.deadline}</div>
                <div className="flex items-center gap-1 text-gray-800">
                  {car.price === '待訂' ? (
                     <span className="text-sm font-black text-[#78B0CF]">價格待訂</span>
                  ) : (
                     <><span className="text-xs">NT$</span> {car.price} <span className="text-[10px] text-gray-300">/ 卡</span></>
                  )}
                </div>
              </div>
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${car.status === 'departed' ? 'bg-green-50 text-green-500 border-green-100' : filled === total ? 'bg-orange-50 text-orange-500 border-orange-100' : 'bg-blue-50 text-blue-500 border-blue-100'}`}>
                {car.status === 'departed' ? '已出發' : filled === total ? '滿車' : '招募中'}
              </span>
            </div>
            <div className="relative h-2 bg-gray-50 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-[#78B0CF] transition-all duration-700 ease-out" style={{ width: `${(filled / total) * 100}%` }} />
            </div>
            <div className="flex justify-between items-center mt-3 font-black text-[10px] text-gray-300 uppercase tracking-widest">
              <span>PROGRESS</span>
              <span className="text-gray-500">{filled} / {total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- My Joined View ---
function MyJoinedCarsView({ cars, user, onViewDetail }) {
  const myCars = cars.filter(car => Object.values(car.members || {}).some(m => m.userId === user.uid));
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-black mb-6 tracking-tight">我的拼車</h2>
      {myCars.length === 0 ? <div className="text-center py-32 text-gray-200 font-black">目前沒有參與任何拼車</div> : 
        myCars.map(car => (
          <div key={car.id} onClick={() => onViewDetail(car)} className="bg-white p-6 rounded-[35px] shadow-sm border-l-8 border-[#78B0CF] mb-4 cursor-pointer active:scale-95 transition-all">
            <span className="font-black text-xl block text-gray-800 mb-1">{car.carTitle}</span>
            <span className="text-xs font-bold text-[#78B0CF] bg-[#78B0CF]/5 px-2 py-1 rounded-md mb-2 inline-block">{car.carNumber} 號車</span>
            <p className="text-gray-400 font-bold text-xs">參與成員：{Object.entries(car.members).filter(([_, v]) => v.userId === user.uid).map(([k]) => MEMBER_ZH[k] || k).join('、')}</p>
          </div>
        ))
      }
    </div>
  );
}

// --- Detail View ---
function CarDetailView({ car, user, db, appId, binders, babyPhotos, onBack, showToast, isAdmin, cars }) {
  const [selected, setSelected] = useState([]);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestedMember, setSuggestedMember] = useState(null);
  const [suggestedMsg, setSuggestedMsg] = useState("");
  const [hasSuggestTriggered, setHasSuggestTriggered] = useState(false);

  const [ig, setIg] = useState('');
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);

  const isHost = car.hostId === user.uid || isAdmin;
  
  const allCarSlots = car.isCustomMode ? (car.customMembers || []) : [...MEMBERS, ...(car.customMembers || [])];
  const filledCount = allCarSlots.filter(m => car.members?.[m]).length;
  const isTBD = car.price === '待訂';

  const handleMemberTap = (m) => {
    if (car.members?.[m] || car.status === 'departed') return;
    setSelected(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const handleJoinClick = () => {
    const availableStandardOthers = allCarSlots.filter(m => !car.members?.[m] && !selected.includes(m) && MEMBERS.includes(m));
    const totalFilledAfterSelection = allCarSlots.filter(m => car.members?.[m] || selected.includes(m)).length;
    const remainingSlots = allCarSlots.length - totalFilledAfterSelection;
    
    // 推坑邏輯
    if (remainingSlots <= 3 && selected.length > 0 && !hasSuggestTriggered && availableStandardOthers.length > 0) {
      const targetKey = availableStandardOthers[Math.floor(Math.random() * availableStandardOthers.length)];
      const targetName = MEMBER_ZH[targetKey] || targetKey;
      const msgs = [
        `認養一下這隻可愛的 ${targetName}寶寶 吧？`,
        `${targetName}寶寶 也很期待跟你一起回家喔！`
      ];
      setSuggestedMember(targetKey);
      setSuggestedMsg(msgs[Math.floor(Math.random() * msgs.length)]);
      setShowSuggest(true);
      setHasSuggestTriggered(true);
      return;
    }
    setShowJoinForm(true);
  };

  const finalizeJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const carRef = doc(db, 'artifacts', appId, 'public', 'data', 'cars', car.id);
      const updatedMembers = { ...car.members };
      selected.forEach(m => {
        updatedMembers[m] = { userId: user.uid, ig, paid, time: new Date().toISOString() };
      });
      await updateDoc(carRef, { members: updatedMembers });

      // 自動將拼車內容加入卡冊
      let targetBinder = binders.find(b => b.title === car.carTitle);
      let binderId = targetBinder?.id;

      if (!targetBinder) {
        const newBinderRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'binders'), {
          title: car.carTitle,
          subtitle: '拼車自動歸檔',
          color: MORANDI_COLORS[0],
          sortOrder: binders.length,
          createdAt: serverTimestamp()
        });
        binderId = newBinderRef.id;
      }

      for (const m of selected) {
        const displayName = MEMBER_ZH[m] || m;
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'cards'), {
          binderId: binderId,
          picBase64: car.cardPic || car.albumPic || '', // Use car pic as fallback
          name: `${car.carTitle} - ${displayName}`,
          price: isTBD ? 0 : Number(car.price),
          shipping: 0,
          status: '已下單',
          resellPrice: '',
          url: '',
          sortOrder: 0,
          createdAt: serverTimestamp()
        });
      }

      setShowJoinForm(false);
      setSelected([]);
      showToast("成功認養並已自動加入卡冊！");
    } catch (err) { alert("系統錯誤"); } finally { setLoading(false); }
  };

  const handleCreateNextCar = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const sameTitleCars = cars.filter(c => c.carTitle === car.carTitle);
      const nextNum = Math.max(...sameTitleCars.map(c => c.carNumber || 0)) + 1;

      const newCar = {
        ...car,
        id: undefined, 
        carNumber: nextNum,
        members: {}, 
        status: 'open',
        createdAt: serverTimestamp()
      };
      delete newCar.id; 
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cars'), newCar);
      showToast(`已成功開啟 ${car.carTitle} ${nextNum} 號車！`);
      onBack();
    } catch (err) { alert("續開失敗"); } finally { setLoading(false); }
  };

  const adminListMembers = car.isCustomMode ? (car.customMembers || []) : [...SORT_ORDER, ...(car.customMembers || [])];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="mb-6 font-black text-gray-300 flex items-center gap-1 hover:text-gray-600 transition-colors"><X size={18} /> 返回列表</button>

      <div className="bg-[#FAF6F4] rounded-[50px] p-8 pb-12 mb-8 shadow-inner border border-white">
        <div className="flex flex-col items-center mb-10">
           {car.channel && <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 border border-gray-200 px-3 py-1 rounded-full">{car.channel}</div>}
           <h1 className="text-2xl font-black text-gray-800 mb-2 text-center">{car.carTitle}</h1>
           <div className="bg-white text-[#78B0CF] font-black text-sm py-2 px-6 rounded-2xl shadow-sm border border-blue-50">{car.carNumber} 號車</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {allCarSlots.map(m => {
            const isTaken = !!car.members?.[m];
            const isSel = selected.includes(m);
            const displayName = MEMBER_ZH[m] || m; 
            
            return (
              <div key={m} onClick={() => handleMemberTap(m)} className={`h-24 rounded-3xl flex items-center justify-center font-black text-xl transition-all relative cursor-pointer ${isTaken ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : isSel ? 'bg-black text-[#78B0CF] scale-95 ring-4 ring-[#78B0CF]/30' : 'bg-[#78B0CF] text-white hover:brightness-105 active:scale-95 shadow-md shadow-[#78B0CF]/10'}`}>
                <span className="text-center px-2 line-clamp-2">{displayName}</span>
                {isTaken && <span className="absolute top-2 right-3 text-[9px] font-bold opacity-30 uppercase tracking-tighter">Taken</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-[40px] p-8 shadow-[0_5px_30px_rgba(0,0,0,0.02)] space-y-6 mb-8 border border-gray-50">
        <h4 className="text-lg font-black mb-4 flex items-center gap-3"><div className="w-1.5 h-5 bg-[#78B0CF] rounded-full" /> 拼車資訊</h4>
        <div className="grid grid-cols-2 gap-y-5 font-bold text-gray-500 text-xs tracking-wide">
          <div className="flex flex-col gap-1"><span className="text-gray-300 uppercase">PRICE</span> <span className={isTBD ? "text-[#78B0CF] text-sm" : "text-gray-800 text-sm"}>{isTBD ? '待訂' : `NT$ ${car.price}`}</span></div>
          <div className="flex flex-col gap-1"><span className="text-gray-300 uppercase">DEADLINE</span> <span className="text-red-300 text-sm">{car.deadline}</span></div>
          <div className="flex flex-col gap-1"><span className="text-gray-300 uppercase">HOST</span> <span className="text-gray-800 text-sm">{car.hostName}</span></div>
          <div className="flex flex-col gap-1"><span className="text-gray-300 uppercase">CONTENT</span> <span className="text-gray-800 text-sm">{car.includesAlbum ? '含專輯' : '僅卡'}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="aspect-square bg-gray-50 rounded-3xl border border-gray-100 flex flex-col items-center justify-center overflow-hidden p-2">
            {car.albumPic ? <img src={car.albumPic} className="w-full h-full object-contain rounded-2xl" /> : <div className="flex flex-col items-center gap-2"><ImageIcon className="text-gray-200" size={24}/><span className="text-[10px] font-black text-gray-200 uppercase">ALBUM</span></div>}
          </div>
          <div className="aspect-square bg-gray-50 rounded-3xl border border-gray-100 flex flex-col items-center justify-center overflow-hidden p-2">
            {car.cardPic ? <img src={car.cardPic} className="w-full h-full object-contain rounded-2xl" /> : <div className="flex flex-col items-center gap-2"><ImageIcon className="text-gray-200" size={24}/><span className="text-[10px] font-black text-gray-200 uppercase">PRE-ORDER</span></div>}
          </div>
        </div>
        
        {isAdmin && car.members && Object.keys(car.members).length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-50">
            <h5 className="text-xs font-black mb-5 text-[#78B0CF] flex items-center gap-2 uppercase tracking-widest">
               <ClipboardList size={14}/> Member List (Admin)
            </h5>
            <div className="space-y-3">
              {adminListMembers.map(mKey => {
                const data = car.members[mKey];
                if (!data) return null;
                return (
                  <div key={mKey} className="bg-gray-50/50 p-4 rounded-2xl flex justify-between items-center border border-gray-50/50">
                    <span className="font-black text-gray-700 max-w-[100px] truncate">{MEMBER_ZH[mKey] || mKey}</span>
                    <div className="text-right">
                      <div className="text-xs font-black text-[#78B0CF]">{data.ig}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-4 mb-20">
          {filledCount === allCarSlots.length && (
            <button 
              onClick={handleCreateNextCar}
              className="w-full bg-[#78B0CF] text-white font-black py-5 rounded-[30px] flex items-center justify-center gap-3 shadow-lg shadow-[#78B0CF]/20 active:scale-95"
            >
              <Plus size={20} /> 新增下一號車 (續開)
            </button>
          )}
          {isHost && car.status !== 'departed' && (
            <button 
              onClick={async () => { if(confirm("確定發車？這會標記此車已出發。")) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cars', car.id), { status: 'departed' }); }} 
              className="w-full bg-black text-white font-black py-5 rounded-[30px] flex items-center justify-center gap-2 shadow-lg active:scale-95"
            >
              <Send size={18} /> 標記為已出發
            </button>
          )}
        </div>
      )}

      {selected.length > 0 && car.status !== 'departed' && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center z-50 px-6">
          <button onClick={handleJoinClick} className="w-full max-w-sm bg-black text-[#78B0CF] font-black py-5 rounded-3xl shadow-2xl active:scale-95 text-xl tracking-tighter">填寫認養資料 ({selected.length})</button>
        </div>
      )}

      {/* Suggest Modal */}
      {showSuggest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-8">
          <div className="bg-white rounded-[50px] p-10 w-full max-w-sm text-center animate-in zoom-in duration-300 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-2 bg-[#78B0CF]/20" />
            
            <div className="w-32 h-32 mx-auto mb-8 rounded-full border-4 border-[#78B0CF]/10 p-2 bg-gray-50 flex items-center justify-center overflow-hidden">
              {babyPhotos[suggestedMember] ? (
                <img src={babyPhotos[suggestedMember]} className="w-full h-full object-cover rounded-full" />
              ) : (
                <Baby className="text-[#78B0CF]/30" size={48} />
              )}
            </div>

            <h3 className="text-2xl font-black mb-3 tracking-tight">認養海外兒童 👶🏻</h3>
            <p className="text-gray-400 font-bold mb-10 text-sm px-4 leading-relaxed">{suggestedMsg}</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setSelected([...selected, suggestedMember]); setShowSuggest(false); setShowJoinForm(true); }} 
                className="bg-black text-[#78B0CF] py-5 rounded-[25px] font-black text-lg shadow-xl active:scale-95 transition-all"
              >
                好呀！多領養一隻
              </button>
              <button 
                onClick={() => { setShowSuggest(false); setShowJoinForm(true); }} 
                className="text-gray-300 font-black py-2 text-sm uppercase tracking-widest"
              >
                NO, THANKS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Form */}
      {showJoinForm && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-[45px] p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[85vh]">
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">填寫領養資料</h2>
            <form onSubmit={finalizeJoin} className="space-y-5">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-300 uppercase ml-2 tracking-widest">INSTAGRAM</label>
                 <input type="text" required placeholder="例如: @kcar_id" className="w-full bg-gray-50 p-5 rounded-2xl outline-none font-bold focus:ring-2 ring-[#78B0CF]/20" value={ig} onChange={e => setIg(e.target.value)} />
              </div>
              
              <label className="flex items-center gap-4 bg-[#78B0CF]/5 border border-[#78B0CF]/10 p-5 rounded-2xl cursor-pointer hover:bg-[#78B0CF]/10 transition-colors">
                <input type="checkbox" className="w-6 h-6 accent-black rounded-lg shrink-0" checked={paid} onChange={e => setPaid(e.target.checked)} />
                <span className="font-bold text-gray-600 text-sm">
                   {isTBD ? '我同意不取消認養' : '我已完成認養費匯款'}
                </span>
              </label>
              
              <button type="submit" disabled={loading} className="w-full bg-black text-[#78B0CF] font-black py-5 rounded-3xl text-xl shadow-lg active:scale-95 mt-4">
                {loading ? '處理中...' : '確認認養'}
              </button>
              <button type="button" onClick={() => setShowJoinForm(false)} className="w-full text-gray-300 font-black text-xs py-2 uppercase tracking-widest">CANCEL</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Create View ---
function CreateCarView({ user, db, appId, cars, initData, clearInitData, onCreated }) {
  const [carTitle, setCarTitle] = useState('');
  const [channel, setChannel] = useState('');
  const [priceTBD, setPriceTBD] = useState(false);
  const [price, setPrice] = useState('');
  const [deadline, setDeadline] = useState('');
  const [shipping, setShipping] = useState('');
  const [isAlbum, setIsAlbum] = useState(false);
  
  // Members State
  const [memberMode, setMemberMode] = useState('standard');
  const [preSelected, setPreSelected] = useState([]);
  const [customSlots, setCustomSlots] = useState([{ name: '', reserved: false }]);

  // Images State
  const [albumPic, setAlbumPic] = useState(null); 
  const [albumB64FromWish, setAlbumB64FromWish] = useState(null); 
  const [cardPic, setCardPic] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initData) {
      setCarTitle(initData.title || '');
      if (initData.picBase64) setAlbumB64FromWish(initData.picBase64);
      clearInitData();
    }
  }, [initData, clearInitData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const sameTitleCars = cars.filter(c => c.carTitle === carTitle);
      const nextNum = sameTitleCars.length > 0 ? Math.max(...sameTitleCars.map(c => c.carNumber || 0)) + 1 : 1;

      let finalAlbumB64 = albumB64FromWish;
      if (albumPic) finalAlbumB64 = await compressImage(albumPic, 600);
      const cardB64 = await compressImage(cardPic, 600);
      
      let initialMembers = {};
      let validCustomMembers = [];
      const isCustomMode = memberMode === 'custom';

      if (isCustomMode) {
        validCustomMembers = customSlots.map(s => s.name.trim()).filter(n => n !== '');
        customSlots.forEach(s => {
          if (s.name.trim() !== '' && s.reserved) {
            initialMembers[s.name.trim()] = { userId: user.uid, ig: "車主保留", paid: true, time: new Date().toISOString() };
          }
        });
      } else {
        preSelected.forEach(m => { 
          initialMembers[m] = { userId: user.uid, ig: "車主保留", paid: true, time: new Date().toISOString() }; 
        });
      }

      const newCar = {
        carTitle: carTitle || 'K-car 拼車',
        channel: channel.trim(),
        carNumber: nextNum,
        hostId: user.uid,
        hostName: "1 號車",
        price: priceTBD ? '待訂' : Number(price),
        deadline,
        shippingTime: shipping,
        includesAlbum: isAlbum,
        albumPic: finalAlbumB64,
        cardPic: cardB64,
        members: initialMembers,
        customMembers: isCustomMode ? validCustomMembers : [],
        isCustomMode: isCustomMode,
        status: 'open',
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cars'), newCar);
      onCreated({ id: docRef.id, ...newCar });
    } catch (err) { alert("建立失敗"); } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-white rounded-[45px] p-8 shadow-sm border border-gray-50 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black mb-8 text-center tracking-tight">建立拼車</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1">
           <label className="text-[10px] font-black text-gray-300 uppercase ml-3 tracking-widest">拼車名稱</label>
           <input type="text" required placeholder="例如: No tragedy 幸運卡" className="w-full bg-gray-50 p-5 rounded-2xl outline-none font-bold focus:ring-2 ring-blue-50 transition-all" value={carTitle} onChange={e => setCarTitle(e.target.value)} />
        </div>
        
        <div className="space-y-1">
           <label className="text-[10px] font-black text-gray-300 uppercase ml-3 tracking-widest">通路 (選填)</label>
           <input type="text" placeholder="例如: Weverse, Soundwave" className="w-full bg-gray-50 p-5 rounded-2xl outline-none font-bold focus:ring-2 ring-blue-50 transition-all" value={channel} onChange={e => setChannel(e.target.value)} />
        </div>

        {/* Toggle */}
        <div className="bg-[#FAF6F4] p-2 rounded-[28px] flex relative border border-white">
          <div className="absolute inset-y-2 w-[calc(50%-0.5rem)] bg-white rounded-3xl shadow-sm transition-all duration-300 ease-out" style={{ left: memberMode === 'standard' ? '0.5rem' : 'calc(50% + 0.5rem)' }} />
          <button type="button" onClick={() => setMemberMode('standard')} className={`flex-1 py-4 text-sm font-black z-10 transition-colors ${memberMode === 'standard' ? 'text-[#78B0CF]' : 'text-gray-400'}`}>6位成員</button>
          <button type="button" onClick={() => setMemberMode('custom')} className={`flex-1 py-4 text-sm font-black z-10 transition-colors ${memberMode === 'custom' ? 'text-[#78B0CF]' : 'text-gray-400'}`}>其他拼車</button>
        </div>

        {memberMode === 'standard' ? (
          <div className="bg-[#FAF6F4] p-6 rounded-3xl space-y-4 border border-white">
            <label className="block text-gray-400 font-black text-[10px] uppercase tracking-widest text-center">預先保留成員 (1 號車)</label>
            <div className="grid grid-cols-2 gap-2">
              {MEMBERS.map(m => (
                <button key={m} type="button" onClick={() => setPreSelected(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])} className={`py-4 rounded-2xl font-black text-xs transition-all shadow-sm truncate px-2 ${preSelected.includes(m) ? 'bg-black text-[#78B0CF]' : 'bg-white text-gray-300'}`}>{m}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50/50 p-6 rounded-3xl space-y-4 border border-blue-50/50">
            <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black text-[#78B0CF] uppercase tracking-widest">自訂拼車欄位</label>
                <button type="button" onClick={() => setCustomSlots([...customSlots, { name: '', reserved: false }])} className="bg-[#78B0CF] text-white p-1.5 rounded-full shadow-md active:scale-95"><Plus size={14}/></button>
            </div>
            <div className="space-y-3">
              {customSlots.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" placeholder="自訂名稱 (例: 團體卡)" className="flex-1 w-0 bg-white p-4 rounded-2xl outline-none font-bold text-sm shadow-sm focus:ring-2 ring-[#78B0CF]/20" value={slot.name} onChange={e => { const newSlots = [...customSlots]; newSlots[idx].name = e.target.value; setCustomSlots(newSlots); }} />
                  <label className="flex items-center justify-center gap-2 bg-white px-3 py-4 rounded-2xl shadow-sm cursor-pointer shrink-0">
                    <input type="checkbox" className="accent-black rounded w-4 h-4" checked={slot.reserved} onChange={e => { const newSlots = [...customSlots]; newSlots[idx].reserved = e.target.checked; setCustomSlots(newSlots); }} />
                    <span className="text-[10px] font-black text-gray-400">保留</span>
                  </label>
                  <button type="button" onClick={() => setCustomSlots(customSlots.filter((_, i) => i !== idx))} className="bg-white text-red-300 hover:text-red-500 p-4 rounded-2xl shadow-sm shrink-0 active:scale-95"><X size={16}/></button>
                </div>
              ))}
              {customSlots.length === 0 && <p className="text-[10px] text-gray-400 font-bold text-center mt-2">點擊右上方按鈕新增自訂成員</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
             <label className="text-[10px] font-black text-gray-300 uppercase ml-3 tracking-widest">PRICE</label>
             {!priceTBD ? (
               <input type="number" required placeholder="單卡價格" className="w-full bg-gray-50 p-5 rounded-2xl outline-none font-bold" value={price} onChange={e => setPrice(e.target.value)} />
             ) : (
               <div className="w-full bg-gray-100 p-5 rounded-2xl font-bold text-gray-400 text-center">待訂</div>
             )}
             <label className="flex items-center gap-2 pl-2 cursor-pointer">
                <input type="checkbox" className="accent-black rounded w-4 h-4" checked={priceTBD} onChange={e => setPriceTBD(e.target.checked)} />
                <span className="text-xs font-bold text-gray-500">價格待訂</span>
             </label>
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black text-gray-300 uppercase ml-3 tracking-widest">DEADLINE</label>
             <input type="date" required className="w-full bg-gray-50 p-5 rounded-2xl outline-none font-bold text-xs" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>

        <input type="text" required placeholder="出貨時間 (例: 12月底)" className="w-full bg-gray-50 p-5 rounded-2xl outline-none font-bold" value={shipping} onChange={e => setShipping(e.target.value)} />
        
        <label className="flex items-center gap-4 bg-gray-50 p-5 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors">
          <input type="checkbox" className="w-6 h-6 accent-black rounded-lg" checked={isAlbum} onChange={e => setIsAlbum(e.target.checked)} />
          <span className="font-bold text-gray-600 text-sm">包含專輯</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative border-2 border-dashed border-gray-100 rounded-3xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors flex flex-col items-center justify-center overflow-hidden h-32">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => setAlbumPic(e.target.files[0])} />
            {albumPic || albumB64FromWish ? (
               <img src={albumPic ? URL.createObjectURL(albumPic) : albumB64FromWish} className="w-full h-full object-cover rounded-xl opacity-50" />
            ) : (
               <div className="flex flex-col items-center gap-1">
                 <ImageIcon className="text-gray-100" size={24} />
                 <span className="font-black text-gray-200 text-[10px] uppercase tracking-tighter">ALBUM PIC</span>
               </div>
            )}
            {(albumPic || albumB64FromWish) && <span className="absolute font-black text-[#78B0CF] text-[10px] bg-white/80 px-2 py-1 rounded">READY</span>}
          </div>
          <div className="relative border-2 border-dashed border-gray-100 rounded-3xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors flex flex-col items-center justify-center overflow-hidden h-32">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => setCardPic(e.target.files[0])} />
            {cardPic ? (
               <img src={URL.createObjectURL(cardPic)} className="w-full h-full object-cover rounded-xl opacity-50" />
            ) : (
               <div className="flex flex-col items-center gap-1">
                 <ImageIcon className="text-gray-100" size={24} />
                 <span className="font-black text-gray-200 text-[10px] uppercase tracking-tighter">PRE-ORDER PIC</span>
               </div>
            )}
            {cardPic && <span className="absolute font-black text-[#78B0CF] text-[10px] bg-white/80 px-2 py-1 rounded">READY</span>}
          </div>
        </div>

        <button type="submit" disabled={submitting} className="w-full bg-black text-[#78B0CF] font-black py-5 rounded-3xl text-xl shadow-lg active:scale-95 transition-all mt-4">
          {submitting ? '建立中...' : '確認開車'}
        </button>
      </form>
    </div>
  );
}

// --- Wishlist View ---
function WishlistView({ wishlists, user, db, appId, showToast, isAdmin, onStartCar }) {
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');
  const [picFile, setPicFile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const sendWish = async (e) => {
    e.preventDefault();
    if (!title.trim() || !msg.trim()) return;
    setLoading(true);
    try {
      let b64 = null;
      if (picFile) b64 = await compressImage(picFile, 600);

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'wishlists'), { 
        userId: user.uid, 
        carTitle: title,
        content: msg, 
        wishPic: b64,
        createdAt: serverTimestamp() 
      });
      setTitle(''); setMsg(''); setPicFile(null);
      showToast("許願成功 ✨");
    } catch (err) { alert("上傳失敗"); } finally { setLoading(false); }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="bg-white rounded-[45px] p-8 mb-8 shadow-sm border border-gray-50">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3 tracking-tight text-gray-800">許願池 ✨</h2>
        <form onSubmit={sendWish} className="flex flex-col gap-4">
          <input type="text" required placeholder="想要拼車的名稱 (例如: Weverse 簽售卡)" className="w-full bg-gray-50 rounded-[20px] px-5 py-4 text-gray-700 font-bold outline-none focus:ring-2 ring-[#78B0CF]/20" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea required placeholder="補充說明 (例如: 想要收誰的...)" rows={2} className="w-full bg-gray-50 rounded-[20px] px-5 py-4 text-gray-700 font-bold outline-none focus:ring-2 ring-[#78B0CF]/20 resize-none" value={msg} onChange={e => setMsg(e.target.value)} />
          
          <div className="relative bg-gray-50 rounded-[20px] p-4 text-center border-2 border-dashed border-gray-200">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setPicFile(e.target.files[0])} />
            <div className="font-bold text-sm text-gray-400 flex items-center justify-center gap-2">
               <Camera size={18}/> {picFile ? '✅ 已選擇照片' : '上傳參考照片 (選填)'}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#78B0CF] text-white font-black py-4 rounded-[20px] active:scale-95 shadow-md shadow-[#78B0CF]/10">
            {loading ? '傳送中...' : '發出許願訊息'}
          </button>
        </form>
      </div>
      
      <div className="space-y-4 px-2">
        {wishlists.map(w => (
          <div key={w.id} className="bg-white p-6 rounded-[30px] shadow-[0_5px_20px_rgba(0,0,0,0.02)] border border-gray-50 animate-in slide-in-from-top-2">
            <div className="flex gap-4 mb-4">
               <div className="w-12 h-12 bg-[#78B0CF]/10 rounded-full flex items-center justify-center text-xl shrink-0">👶🏻</div>
               <div className="flex-1">
                  <h4 className="font-black text-lg text-gray-800">{w.carTitle}</h4>
                  <p className="font-bold text-gray-500 text-sm mt-1">{w.content}</p>
               </div>
            </div>
            {w.wishPic && (
               <img src={w.wishPic} className="w-full h-32 object-cover rounded-2xl mb-4 opacity-80" />
            )}
            {isAdmin && (
               <button onClick={() => onStartCar(w)} className="w-full bg-black text-[#78B0CF] font-black py-3 rounded-2xl flex justify-center items-center gap-2">
                 <Store size={16}/> 開始這團拼車
               </button>
            )}
          </div>
        ))}
        {wishlists.length === 0 && <div className="text-center py-20 text-gray-200 font-black italic">No wishes yet...</div>}
      </div>
    </div>
  );
}

// --- Nursery View ---
function NurseryView({ db, appId, babyPhotos, showToast }) {
  const [croppingFile, setCroppingFile] = useState(null);
  const [activeMember, setActiveMember] = useState(null);
  const [loadingKey, setLoadingKey] = useState(null);

  const handleSelectFile = (mKey, file) => {
    if (!file) return;
    setActiveMember(mKey);
    setCroppingFile(file);
  };

  const handleCropComplete = async (base64) => {
    const mKey = activeMember;
    setCroppingFile(null);
    setActiveMember(null);
    setLoadingKey(mKey);
    try {
      const babyRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'babyPhotos');
      await setDoc(babyRef, { [mKey]: base64 }, { merge: true });
      showToast(`${MEMBER_ZH[mKey]}寶寶頭像已更新 👶🏻`);
    } catch (err) { alert("上傳失敗"); } finally { setLoadingKey(null); }
  };

  return (
    <div className="bg-white rounded-[45px] p-8 shadow-sm border border-gray-100 animate-in fade-in">
      <div className="text-center mb-10">
         <h2 className="text-3xl font-black text-gray-800 mb-2">託嬰中心 👶🏻</h2>
         <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Nursery Management</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {SORT_ORDER.map(mKey => (
          <div key={mKey} className="flex flex-col items-center bg-[#FAF6F4] p-6 rounded-[35px] border border-white shadow-inner group transition-all">
            <div className="relative w-24 h-24 mb-4">
               <div className="w-full h-full rounded-full bg-white shadow-sm border-2 border-white flex items-center justify-center overflow-hidden">
                 {babyPhotos[mKey] ? (
                   <img src={babyPhotos[mKey]} className="w-full h-full object-cover" />
                 ) : (
                   <User className="text-gray-100" size={32} />
                 )}
                 {loadingKey === mKey && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                       <div className="w-5 h-5 border-2 border-[#78B0CF] border-t-transparent rounded-full animate-spin" />
                    </div>
                 )}
               </div>
               <label className="absolute bottom-0 right-0 w-8 h-8 bg-black text-[#78B0CF] rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-90 transition-transform">
                 <Camera size={14} />
                 <input type="file" accept="image/*" className="hidden" onChange={e => handleSelectFile(mKey, e.target.files[0])} />
               </label>
            </div>
            <span className="font-black text-gray-800 text-sm">{MEMBER_ZH[mKey]}寶寶</span>
          </div>
        ))}
      </div>

      {croppingFile && (
        <ImageCropperModal 
          file={croppingFile} 
          onCrop={handleCropComplete} 
          onCancel={() => { setCroppingFile(null); setActiveMember(null); }} 
        />
      )}
    </div>
  );
}

// --- Binder List View ---
function BinderListView({ binders, user, db, appId, onSelect, showToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [color, setColor] = useState(MORANDI_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  // Sorting state
  const [localBinders, setLocalBinders] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    setLocalBinders([...binders]);
  }, [binders]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'binders'), {
        title, subtitle, color, sortOrder: binders.length, createdAt: serverTimestamp()
      });
      setShowCreate(false); setTitle(''); setSubtitle(''); setColor(MORANDI_COLORS[0]);
      showToast("卡冊建立成功！");
    } catch (err) { alert("建立失敗"); } finally { setSubmitting(false); }
  };

  // DnD Handlers
  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = "move";
    setDragIndex(index);
  };
  const handleDragEnter = (e, index) => setDragOverIndex(index);
  const handleDragEnd = async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const newList = [...localBinders];
    const [removed] = newList.splice(dragIndex, 1);
    newList.splice(dragOverIndex, 0, removed);
    setLocalBinders(newList);
    setDragIndex(null); setDragOverIndex(null);

    // Sync to DB
    for (let i = 0; i < newList.length; i++) {
       if (newList[i].sortOrder !== i) {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'binders', newList[i].id), { sortOrder: i });
       }
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-black tracking-tight">我的卡冊</h2>
        <button onClick={() => setShowCreate(true)} className="bg-[#78B0CF] text-white p-3 rounded-full shadow-lg shadow-[#78B0CF]/20 active:scale-95 transition-transform"><Plus size={24} /></button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {localBinders.map((b, index) => (
          <div 
             key={b.id} 
             onClick={() => onSelect(b)} 
             draggable
             onDragStart={(e) => handleDragStart(e, index)}
             onDragEnter={(e) => handleDragEnter(e, index)}
             onDragEnd={handleDragEnd}
             onDragOver={(e) => e.preventDefault()}
             className={`aspect-[3/4] rounded-[24px] p-5 cursor-pointer shadow-sm active:scale-95 transition-all flex flex-col justify-center border border-black/5 ${dragOverIndex === index ? 'ring-4 ring-black/20 opacity-80 scale-105' : ''} ${dragIndex === index ? 'opacity-30' : ''}`} 
             style={{ backgroundColor: b.color }}
          >
            <h3 className="text-2xl font-black text-gray-800 break-words leading-tight pointer-events-none">{b.title}</h3>
            {b.subtitle && <p className="text-sm font-bold text-gray-700/70 mt-2 line-clamp-2 pointer-events-none">{b.subtitle}</p>}
          </div>
        ))}
      </div>
      {localBinders.length === 0 && !showCreate && <div className="text-center py-40 text-gray-300 font-black italic">尚無卡冊，點擊右上角新增</div>}

      {showCreate && (
         <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white rounded-[45px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-2xl font-black mb-6">新增卡冊</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <input type="text" required placeholder="卡冊標題" className="w-full bg-gray-50 p-5 rounded-2xl font-bold outline-none focus:ring-2 ring-[#78B0CF]/20" value={title} onChange={e => setTitle(e.target.value)} />
                <input type="text" placeholder="副標題 (選填)" className="w-full bg-gray-50 p-5 rounded-2xl font-bold outline-none focus:ring-2 ring-[#78B0CF]/20 text-sm" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
                <div className="pt-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 ml-2">選擇封面顏色</label>
                   <div className="grid grid-cols-5 gap-3">
                     {MORANDI_COLORS.map(c => (
                       <div key={c} onClick={() => setColor(c)} className={`w-full aspect-square rounded-full cursor-pointer transition-transform ${color === c ? 'scale-110 ring-4 ring-gray-200 shadow-sm' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                     ))}
                   </div>
                </div>
                <div className="flex gap-3 pt-6">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-4 text-gray-400 font-bold bg-gray-50 rounded-2xl">取消</button>
                  <button type="submit" disabled={submitting} className="flex-[2] bg-black text-[#78B0CF] font-black py-4 rounded-2xl shadow-lg disabled:opacity-50">建立卡冊</button>
                </div>
              </form>
            </div>
         </div>
      )}
    </div>
  );
}

// --- Binder Detail View ---
function BinderDetailView({ binder, cards, user, db, appId, onBack, showToast, onDelete }) {
  const [uploading, setUploading] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  
  // Edit Binder State
  const [showEditBinder, setShowEditBinder] = useState(false);
  const [editTitle, setEditTitle] = useState(binder.title);
  const [editSubtitle, setEditSubtitle] = useState(binder.subtitle);
  const [editColor, setEditColor] = useState(binder.color);
  
  // Sorting state for cards
  const [localCards, setLocalCards] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => { setLocalCards([...cards]); }, [cards]);

  const handleBatchUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploadPromises = files.map(async (file, idx) => {
        const b64 = await compressImage(file, 600);
        if (b64) {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'cards'), {
            binderId: binder.id,
            picBase64: b64,
            name: '新小卡',
            price: 0,
            shipping: 0,
            status: '已下單',
            resellPrice: '',
            url: '',
            sortOrder: cards.length + idx,
            createdAt: serverTimestamp()
          });
        }
      });
      await Promise.all(uploadPromises);
      showToast(`成功匯入 ${files.length} 張小卡！`);
    } catch (err) { alert("匯入失敗"); } finally { setUploading(false); e.target.value = null; }
  };

  const handleUpdateBinder = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'binders', binder.id), {
        title: editTitle, subtitle: editSubtitle, color: editColor
      });
      binder.title = editTitle; binder.subtitle = editSubtitle; binder.color = editColor;
      setShowEditBinder(false);
      showToast("卡冊已更新！");
    } catch (err) { alert("更新失敗"); }
  };

  const handleDeleteBinder = async () => {
    if (window.confirm('確定要刪除此卡冊嗎？裡面的小卡記錄也會一併移除。')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'binders', binder.id));
        showToast("卡冊已刪除");
        onDelete();
      } catch (err) { alert("刪除失敗"); }
    }
  };

  // DnD Handlers for Cards
  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = "move";
    setDragIndex(index);
  };
  const handleDragEnter = (e, index) => setDragOverIndex(index);
  const handleDragEnd = async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const newList = [...localCards];
    const [removed] = newList.splice(dragIndex, 1);
    newList.splice(dragOverIndex, 0, removed);
    setLocalCards(newList);
    setDragIndex(null); setDragOverIndex(null);

    // Sync to DB
    for (let i = 0; i < newList.length; i++) {
       if (newList[i].sortOrder !== i) {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', newList[i].id), { sortOrder: i });
       }
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-center mb-6">
         <button onClick={onBack} className="font-black text-gray-300 flex items-center gap-1 hover:text-gray-600 transition-colors"><X size={18} /> 返回</button>
         <button onClick={() => setShowEditBinder(true)} className="text-gray-400 hover:text-gray-800"><Settings size={22} /></button>
      </div>
      
      <div className="flex justify-between items-end mb-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-50" style={{ borderLeft: `12px solid ${binder.color}` }}>
         <div>
            <h2 className="text-3xl font-black text-gray-800">{binder.title}</h2>
            {binder.subtitle && <p className="text-sm font-bold text-gray-400 mt-2">{binder.subtitle}</p>}
         </div>
         <div className="relative shrink-0">
            <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleBatchUpload} disabled={uploading} title="批次新增小卡" />
            <button disabled={uploading} className="bg-black text-[#78B0CF] p-4 rounded-full shadow-xl active:scale-95 disabled:opacity-50">
              <Upload size={20} />
            </button>
         </div>
      </div>

      {uploading && <div className="text-center text-[#78B0CF] font-black text-sm mb-6 animate-pulse">小卡匯入中，請稍候...</div>}

      <div className="grid grid-cols-3 gap-3">
         {localCards.map((c, index) => {
           const total = (Number(c.price) || 0) + (Number(c.shipping) || 0);
           const isSold = c.resellPrice && Number(c.resellPrice) > 0;
           
           return (
             <div 
               key={c.id} 
               onClick={() => setEditingCard(c)} 
               draggable
               onDragStart={(e) => handleDragStart(e, index)}
               onDragEnter={(e) => handleDragEnter(e, index)}
               onDragEnd={handleDragEnd}
               onDragOver={(e) => e.preventDefault()}
               className={`aspect-[3/5] bg-gray-100 rounded-[20px] overflow-hidden relative cursor-pointer shadow-sm active:scale-95 transition-all group ${dragOverIndex === index ? 'ring-2 ring-black/40 scale-105 opacity-80' : ''} ${dragIndex === index ? 'opacity-30' : ''}`}
             >
               <img src={c.picBase64} className="w-full h-full object-cover pointer-events-none" />
               
               {/* 售出狀態 Overlay */}
               {isSold && (
                 <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-20">
                   <span className="bg-black/80 text-white font-black px-4 py-2 rounded-full text-xs transform -rotate-12 border border-white/20">已售出</span>
                 </div>
               )}

               {/* 半透明白底文字區 */}
               <div className="absolute inset-x-0 bottom-0 bg-white/85 backdrop-blur-md p-3 pt-3 flex flex-col justify-end z-10 border-t border-white/50">
                 <p className="text-gray-800 text-[11px] font-black truncate mb-0.5 pointer-events-none">{c.name}</p>
                 <p className="text-[#78B0CF] text-xs font-black pointer-events-none">NT$ {total}</p>
               </div>
             </div>
           )
         })}
      </div>
      {localCards.length === 0 && !uploading && <div className="text-center py-32 text-gray-300 font-black italic">尚無小卡，點擊上方按鈕匯入</div>}

      {/* Edit Binder Modal */}
      {showEditBinder && (
         <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white rounded-[45px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-2xl font-black mb-6">編輯卡冊</h3>
              <form onSubmit={handleUpdateBinder} className="space-y-4">
                <input type="text" required placeholder="卡冊標題" className="w-full bg-gray-50 p-5 rounded-2xl font-bold outline-none focus:ring-2 ring-[#78B0CF]/20" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                <input type="text" placeholder="副標題 (選填)" className="w-full bg-gray-50 p-5 rounded-2xl font-bold outline-none focus:ring-2 ring-[#78B0CF]/20 text-sm" value={editSubtitle} onChange={e => setEditSubtitle(e.target.value)} />
                <div className="pt-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 ml-2">封面顏色</label>
                   <div className="grid grid-cols-5 gap-3">
                     {MORANDI_COLORS.map(c => (
                       <div key={c} onClick={() => setEditColor(c)} className={`w-full aspect-square rounded-full cursor-pointer transition-transform ${editColor === c ? 'scale-110 ring-4 ring-gray-200 shadow-sm' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                     ))}
                   </div>
                </div>
                <div className="flex flex-col gap-3 pt-6">
                  <button type="submit" className="w-full bg-black text-[#78B0CF] font-black py-4 rounded-2xl shadow-lg">儲存變更</button>
                  <button type="button" onClick={() => setShowEditBinder(false)} className="w-full py-3 text-gray-400 font-bold bg-gray-50 rounded-2xl">取消</button>
                  <button type="button" onClick={handleDeleteBinder} className="w-full py-3 text-red-400 font-black mt-4 hover:bg-red-50 rounded-2xl transition-colors">刪除此卡冊</button>
                </div>
              </form>
            </div>
         </div>
      )}

      {editingCard && <CardDetailModal card={editingCard} user={user} db={db} appId={appId} onClose={() => setEditingCard(null)} showToast={showToast} />}
    </div>
  );
}

// --- Card Detail Modal ---
function CardDetailModal({ card, user, db, appId, onClose, showToast }) {
  const [name, setName] = useState(card.name || '');
  const [price, setPrice] = useState(card.price || 0);
  const [shipping, setShipping] = useState(card.shipping || 0);
  const [url, setUrl] = useState(card.url || '');
  
  const [status, setStatus] = useState(card.status || '已下單');
  const [resellPrice, setResellPrice] = useState(card.resellPrice || '');
  
  const [saving, setSaving] = useState(false);

  const total = (Number(price) || 0) + (Number(shipping) || 0);
  const profit = Number(resellPrice) - total;
  const isSold = resellPrice && Number(resellPrice) > 0;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', card.id), {
        name, price: Number(price), shipping: Number(shipping), url, status, resellPrice
      });
      showToast("小卡資訊已更新！");
      onClose();
    } catch (err) { alert("更新失敗"); } finally { setSaving(false); }
  };

  const handleDeleteCard = async () => {
    if (window.confirm('確定要刪除此小卡嗎？此操作無法還原。')) {
      setSaving(true);
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', card.id));
        showToast("小卡已刪除");
        onClose();
      } catch (err) { alert("刪除失敗"); } finally { setSaving(false); }
    }
  };

  const handleOpenUrl = () => {
    if (!url) return;
    let finalUrl = url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    window.open(finalUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[150] flex flex-col items-center justify-center p-6 backdrop-blur-sm">
       <div className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="relative h-[35vh] bg-gray-50 shrink-0 border-b border-gray-100 flex items-center justify-center">
             <img src={card.picBase64} className={`max-w-full max-h-full object-contain ${isSold ? 'grayscale opacity-60' : ''}`} />
             <div className="absolute top-4 right-4 flex gap-2">
                <button type="button" onClick={handleDeleteCard} className="bg-red-500/80 text-white p-2.5 rounded-full backdrop-blur-md hover:bg-red-600 transition-colors shadow-sm"><Trash2 size={16}/></button>
                <button onClick={onClose} className="bg-black/30 text-white p-2.5 rounded-full backdrop-blur-md hover:bg-black/50 transition-colors shadow-sm"><X size={16}/></button>
             </div>
             {isSold && <div className="absolute bg-black text-white px-6 py-2 rounded-full font-black text-lg transform -rotate-12 border-2 border-white">已售出</div>}
          </div>
          
          <div className="p-8 overflow-y-auto">
             <form onSubmit={handleSave} className="space-y-5">
                
                {/* 狀態切換 */}
                <div className="flex gap-2 mb-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                  {['已下單', '已出貨', '完成'].map(s => (
                    <button type="button" key={s} onClick={() => setStatus(s)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-colors ${status === s ? 'bg-black text-[#78B0CF] shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>
                       {s}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">小卡名稱</label>
                  <input type="text" className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-[#78B0CF]/20" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">購入價格</label>
                    <input type="number" className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-[#78B0CF]/20" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">二補/運費</label>
                    <input type="number" className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-[#78B0CF]/20" value={shipping} onChange={e => setShipping(e.target.value)} />
                  </div>
                </div>

                <div className="bg-[#78B0CF]/10 p-5 rounded-2xl flex justify-between items-center border border-[#78B0CF]/20">
                   <span className="text-xs font-black text-[#78B0CF] uppercase tracking-widest">總購入成本</span>
                   <span className="text-xl font-black text-[#78B0CF]">NT$ {total}</span>
                </div>

                <div className="border-t border-dashed border-gray-200 pt-4">
                   <div className="space-y-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">轉賣價格 (選填)</label>
                     <input type="number" placeholder="若已售出請輸入價格" className="w-full bg-orange-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-orange-200 text-orange-800" value={resellPrice} onChange={e => setResellPrice(e.target.value)} />
                   </div>
                   {isSold && (
                      <div className={`mt-3 ml-2 text-xs font-black flex items-center gap-2 ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                         <span>{profit >= 0 ? '✨ 淨賺利潤' : '📉 虧損金額'}</span>
                         <span className="text-lg">NT$ {Math.abs(profit)}</span>
                      </div>
                   )}
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex justify-between items-center">
                     <span>卡源網址</span>
                     {url && <span onClick={handleOpenUrl} className="text-[#78B0CF] cursor-pointer hover:underline flex items-center gap-1"><ExternalLink size={10}/> 點擊前往</span>}
                  </label>
                  <input type="text" placeholder="https://..." className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-[#78B0CF]/20 text-xs" value={url} onChange={e => setUrl(e.target.value)} />
                </div>

                <button type="submit" disabled={saving} className="w-full bg-black text-[#78B0CF] font-black py-4 rounded-2xl mt-6 shadow-md active:scale-95 transition-all">儲存變更</button>
             </form>
          </div>
       </div>
    </div>
  );
}