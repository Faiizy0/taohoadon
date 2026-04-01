import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, Receipt, User, Calendar, Calculator, Save, History, FileText, Edit, Globe, Eye, X, Copy, Download, Settings, RefreshCw, Key } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

// Firestore Error Handler
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'anonymous',
      email: null,
      emailVerified: false,
      isAnonymous: true,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ProductItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  orderDate: string;
}

interface AdvancePayment {
  id: string;
  date: string;
  amount: number;
}

interface Invoice {
  id: string;
  customerName: string;
  invoiceDate: string;
  items: ProductItem[];
  advances: AdvancePayment[];
  total: number;
  updatedAt: number;
}

const translations = {
  en: {
    appTitle: "Invoice Generation",
    appSubtitle: "Produced by Đại Vĩ",
    editor: "Editor",
    history: "History",
    clientInfo: "Client Information",
    advanceInfo: "Advance Payment",
    customerNameLabel: "1. Customer Name",
    customerNamePlaceholder: "Enter customer name",
    invoiceDateLabel: "2. Invoice Date",
    ordersByDate: "Delivery",
    noOrders: "No deliveries added yet.",
    addNewOrder: "Add New Delivery",
    orderDate: "Delivery Date",
    productNameLabel: "3. Name of Product",
    productNamePlaceholder: "e.g. Laptop",
    quantityLabel: "4. Quantity",
    priceLabel: "5. Price ($)",
    addBtn: "Add",
    invoiceSummary: "Invoice Summary",
    totalAmount: "Total Amount",
    billedTo: "Billed To",
    totalProductTypes: "Total Product Types",
    orderDays: "Delivery Days",
    advanceDateLabel: "Advance Date",
    advanceAmountLabel: "Advance Amount ($)",
    addAdvanceBtn: "Add Advance",
    subtotal: "Subtotal",
    totalDue: "Total",
    day: "day",
    days: "days",
    saveInvoice: "Save Invoice",
    updateInvoice: "Update Invoice",
    startNew: "Start New Invoice",
    editingSaved: "Editing Saved Invoice",
    invoiceHistory: "Invoice History",
    newInvoice: "New Invoice",
    noInvoices: "No invoices saved yet.",
    thDate: "Date",
    thCustomer: "Customer",
    thItems: "Items",
    thTotal: "Total ($)",
    thActions: "Actions",
    unnamedClient: "Unnamed Client",
    itemsCount: "types",
    each: "each",
    saveSuccess: "Invoice saved successfully!",
    exportImage: "Preview Invoice",
    downloadImage: "Save Image",
    copyImage: "Copy Image",
    exportSuccess: "Image saved successfully!",
    copySuccess: "Image copied to clipboard!",
    colDate: "Ngày",
    colProduct: "Mẫu",
    colQty: "Số lượng",
    colPrice: "Giá",
    colTotal: "Thành Tiền",
    totalLabel: "Tổng",
    deleteConfirm: "Are you sure you want to delete this invoice?",
    cancel: "Cancel",
    confirm: "Confirm Delete"
  },
  vi: {
    appTitle: "Tạo Hóa đơn",
    appSubtitle: "Produced by Đại Vĩ",
    editor: "Soạn thảo",
    history: "Lịch sử",
    clientInfo: "Thông tin Khách hàng",
    advanceInfo: "Thông tin Ứng trước",
    customerNameLabel: "1. Tên Khách hàng",
    customerNamePlaceholder: "Nhập tên khách hàng",
    invoiceDateLabel: "2. Ngày lập Hóa đơn",
    ordersByDate: "Giao hàng",
    noOrders: "Chưa có lịch giao hàng nào.",
    addNewOrder: "Thêm Lịch giao Mới",
    orderDate: "Ngày giao hàng",
    productNameLabel: "3. Tên Sản phẩm",
    productNamePlaceholder: "VD: Laptop",
    quantityLabel: "4. Số lượng",
    priceLabel: "5. Giá ($)",
    addBtn: "Thêm",
    invoiceSummary: "Tóm tắt Hóa đơn",
    totalAmount: "Tổng cộng",
    billedTo: "Người nhận",
    totalProductTypes: "Tổng số loại sản phẩm",
    orderDays: "Số ngày giao hàng",
    advanceDateLabel: "Ngày ứng trước",
    advanceAmountLabel: "Số tiền ứng trước ($)",
    addAdvanceBtn: "Thêm Ứng trước",
    subtotal: "Tổng tiền hàng",
    totalDue: "Tổng thanh toán",
    day: "ngày",
    days: "ngày",
    saveInvoice: "Lưu Hóa đơn",
    updateInvoice: "Cập nhật Hóa đơn",
    startNew: "Tạo Hóa đơn Mới",
    editingSaved: "Đang sửa Hóa đơn đã lưu",
    invoiceHistory: "Lịch sử Hóa đơn",
    newInvoice: "Hóa đơn Mới",
    noInvoices: "Chưa có hóa đơn nào được lưu.",
    thDate: "Ngày",
    thCustomer: "Khách hàng",
    thItems: "Mặt hàng",
    thTotal: "Tổng ($)",
    thActions: "Thao tác",
    unnamedClient: "Khách hàng ẩn danh",
    itemsCount: "loại",
    each: "mỗi cái",
    saveSuccess: "Lưu hóa đơn thành công!",
    exportImage: "Xem Hóa đơn",
    downloadImage: "Lưu Ảnh",
    copyImage: "Sao chép Ảnh",
    exportSuccess: "Lưu ảnh thành công!",
    copySuccess: "Đã sao chép ảnh vào khay nhớ tạm!",
    colDate: "Ngày",
    colProduct: "Mẫu",
    colQty: "Số lượng",
    colPrice: "Giá",
    colTotal: "Thành Tiền",
    totalLabel: "Tổng",
    deleteConfirm: "Bạn có chắc chắn muốn xóa hóa đơn này không?",
    cancel: "Hủy",
    confirm: "Xác nhận Xóa"
  }
};

export default function App() {
  // App State
  const [lang, setLang] = useState<'en' | 'vi'>('en');
  const t = translations[lang];

  const [syncKey, setSyncKey] = useState(() => {
    const saved = localStorage.getItem('invoice_sync_key');
    if (saved) return saved;
    const newKey = 'sync-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('invoice_sync_key', newKey);
    return newKey;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [tempSyncKey, setTempSyncKey] = useState(syncKey);

  const [view, setView] = useState<'editor' | 'history'>('editor');
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Current Invoice State
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(() => localStorage.getItem('draft_invoiceId') || null);
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('draft_customerName') || '');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    return localStorage.getItem('draft_invoiceDate') || new Date().toISOString().split('T')[0];
  });
  const [advances, setAdvances] = useState<AdvancePayment[]>(() => {
    const saved = localStorage.getItem('draft_advances');
    return saved ? JSON.parse(saved) : [];
  });
  const [items, setItems] = useState<ProductItem[]>(() => {
    const saved = localStorage.getItem('draft_items');
    return saved ? JSON.parse(saved) : [];
  });

  // New Item State
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [newItemDate, setNewItemDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // New Advance State
  const [newAdvanceDate, setNewAdvanceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [newAdvanceAmount, setNewAdvanceAmount] = useState('');

  // Firestore listener
  useEffect(() => {
    if (!syncKey) return;

    setIsSyncing(true);
    const q = query(
      collection(db, 'sync', syncKey, 'invoices'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data() as Invoice);
      setInvoices(docs);
      setIsSyncing(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `sync/${syncKey}/invoices`);
      setIsSyncing(false);
    });

    return () => unsubscribe();
  }, [syncKey]);

  const handleUpdateSyncKey = () => {
    if (tempSyncKey.trim().length < 8) {
      showToast(lang === 'en' ? 'Key must be at least 8 characters' : 'Mã phải có ít nhất 8 ký tự');
      return;
    }
    setSyncKey(tempSyncKey.trim());
    localStorage.setItem('invoice_sync_key', tempSyncKey.trim());
    setShowSyncSettings(false);
    showToast(lang === 'en' ? 'Sync key updated!' : 'Đã cập nhật mã đồng bộ!');
  };

  // Save draft to local storage
  useEffect(() => {
    if (currentInvoiceId) localStorage.setItem('draft_invoiceId', currentInvoiceId);
    else localStorage.removeItem('draft_invoiceId');
    
    localStorage.setItem('draft_customerName', customerName);
    localStorage.setItem('draft_invoiceDate', invoiceDate);
    localStorage.setItem('draft_advances', JSON.stringify(advances));
    localStorage.setItem('draft_items', JSON.stringify(items));
  }, [currentInvoiceId, customerName, invoiceDate, advances, items]);

  const formatCurrency = (amount: number) => {
    return '$' + new Intl.NumberFormat('vi-VN').format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  };

  const formatPriceInput = (value: string) => {
    if (!value) return '';
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '');
    if (/^\d*$/.test(rawValue)) {
      setNewItemPrice(rawValue);
    }
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice || !newItemDate) return;

    const price = parseFloat(newItemPrice);
    const quantity = parseInt(newItemQuantity, 10);

    if (isNaN(price) || isNaN(quantity) || price < 0 || quantity < 1) return;

    const newItem: ProductItem = {
      id: Date.now().toString(),
      name: newItemName,
      price,
      quantity,
      orderDate: newItemDate
    };

    setItems([...items, newItem]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQuantity('1');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const addAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdvanceDate || !newAdvanceAmount) return;

    const amount = parseInt(newAdvanceAmount.replace(/\./g, ''), 10);
    if (isNaN(amount) || amount <= 0) return;

    const newAdvance: AdvancePayment = {
      id: Date.now().toString(),
      date: newAdvanceDate,
      amount
    };

    setAdvances([...advances, newAdvance]);
    setNewAdvanceAmount('');
  };

  const removeAdvance = (id: string) => {
    setAdvances(advances.filter(adv => adv.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const parsedAdvance = useMemo(() => {
    return advances.reduce((sum, adv) => sum + adv.amount, 0);
  }, [advances]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - parsedAdvance);
  }, [subtotal, parsedAdvance]);

  const groupedItems = useMemo(() => {
    const groups = items.reduce((acc, item) => {
      if (!acc[item.orderDate]) {
        acc[item.orderDate] = [];
      }
      acc[item.orderDate].push(item);
      return acc;
    }, {} as Record<string, ProductItem[]>);
    
    return Object.keys(groups).sort().map(date => ({
      date,
      items: groups[date]
    }));
  }, [items]);

  const flattenedItems = useMemo(() => {
    return groupedItems.flatMap(group => 
      group.items.map((item, index) => ({
        ...item,
        isFirstInGroup: index === 0,
        displayDate: group.date
      }))
    );
  }, [groupedItems]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatExportDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  };

  const handleSaveImage = async () => {
    const element = document.getElementById('export-table-container');
    if (!element) return;
    
    try {
      showToast('Generating image...');
      
      const dataUrl = await htmlToImage.toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      // Sanitize customer name to prevent invalid characters from breaking the file extension
      const safeName = (customerName || 'Unnamed').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Invoice_${safeName}_${new Date().getTime()}.png`;
      
      const triggerDownload = () => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(t.exportSuccess);
      };
      
      // Try Web Share API for mobile (Save to Photos)
      if (navigator.canShare) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], filename, { type: 'image/png' });
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Invoice',
            });
            showToast(t.exportSuccess);
            return;
          }
        } catch (shareError) {
          // If user cancels or it fails, fallback to standard download
          if ((shareError as Error).name !== 'AbortError') {
            triggerDownload();
          }
          return;
        }
      }
      
      // Fallback for desktop
      triggerDownload();
      
    } catch (error) {
      console.error('Error exporting image:', error);
      showToast('Export failed');
    }
  };

  const handleCopyImage = async () => {
    const element = document.getElementById('export-table-container');
    if (!element) return;
    
    try {
      showToast('Generating image...');
      
      const blob = await htmlToImage.toBlob(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      if (!blob) {
        throw new Error('Failed to generate image blob');
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      
      showToast(t.copySuccess);
    } catch (error) {
      console.error('Error copying image:', error);
      showToast('Copy failed. Your browser might not support this feature.');
    }
  };

  const saveInvoice = async () => {
    const invoiceId = currentInvoiceId || Date.now().toString();
    const newInvoice: Invoice & { syncKey: string } = {
      id: invoiceId,
      syncKey: syncKey,
      customerName,
      invoiceDate,
      items,
      advances,
      total,
      updatedAt: Date.now(),
    };

    try {
      await setDoc(doc(db, 'sync', syncKey, 'invoices', invoiceId), newInvoice);
      setCurrentInvoiceId(invoiceId);
      showToast(t.saveSuccess);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sync/${syncKey}/invoices/${invoiceId}`);
    }
  };

  const createNewInvoice = () => {
    setCurrentInvoiceId(null);
    setCustomerName('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setAdvances([]);
    setItems([]);
    setView('editor');
  };

  const loadInvoice = (invoice: Invoice) => {
    setCurrentInvoiceId(invoice.id);
    setCustomerName(invoice.customerName);
    setInvoiceDate(invoice.invoiceDate);
    setAdvances(invoice.advances || []);
    setItems(invoice.items);
    setView('editor');
  };

  const confirmDelete = (id: string) => {
    setInvoiceToDelete(id);
  };

  const executeDelete = async () => {
    if (invoiceToDelete) {
      try {
        await deleteDoc(doc(db, 'sync', syncKey, 'invoices', invoiceToDelete));
        if (currentInvoiceId === invoiceToDelete) {
          createNewInvoice();
          setView('history');
        }
        setInvoiceToDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `sync/${syncKey}/invoices/${invoiceToDelete}`);
      }
    }
  };

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'vi' : 'en');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-xl text-white shadow-sm">
              <Calculator size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t.appTitle}</h1>
              <p className="text-sm text-gray-500">{t.appSubtitle}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSyncSettings(true)}
                className={`flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ${isSyncing ? 'animate-pulse' : ''}`}
                title="Sync Settings"
              >
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : 'text-blue-500'} />
                <span className="hidden sm:inline">{lang === 'en' ? 'Sync' : 'Đồng bộ'}</span>
              </button>
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Globe size={16} className="text-blue-500" />
                {lang === 'en' ? 'VI' : 'EN'}
              </button>
            </div>

            <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1 w-full sm:w-auto">
              <button
                onClick={() => setView('editor')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'editor' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText size={16} />
                {t.editor}
              </button>
              <button
                onClick={() => setView('history')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'history' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <History size={16} />
                {t.history}
              </button>
            </div>
          </div>
        </header>

        {view === 'history' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History size={20} className="text-gray-400" />
                {t.invoiceHistory}
              </h2>
              <button
                onClick={createNewInvoice}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                {t.newInvoice}
              </button>
            </div>
            <div className="p-0">
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText size={48} className="mx-auto mb-4 opacity-20" />
                  <p>{t.noInvoices}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                        <th className="p-4 font-medium">{t.thDate}</th>
                        <th className="p-4 font-medium">{t.thCustomer}</th>
                        <th className="p-4 font-medium">{t.thItems}</th>
                        <th className="p-4 font-medium text-right">{t.thTotal}</th>
                        <th className="p-4 font-medium text-right">{t.thActions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invoices.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime() || b.updatedAt - a.updatedAt).map(inv => (
                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-sm text-gray-900">{formatDate(inv.invoiceDate)}</td>
                          <td className="p-4 text-sm font-medium text-gray-900">{inv.customerName || t.unnamedClient}</td>
                          <td className="p-4 text-sm text-gray-500">{new Set(inv.items.map(item => item.name.trim().toLowerCase())).size} {t.itemsCount}</td>
                          <td className="p-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(inv.total)}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => loadInvoice(inv)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title={t.updateInvoice}
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => confirmDelete(inv.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Invoice"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Inputs & Items */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Customer & Invoice Info */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <User size={20} className="text-gray-400" />
                    {t.clientInfo}
                  </h2>
                  {currentInvoiceId && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1">
                      <Edit size={12} /> {t.editingSaved}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="customerName" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                      {t.customerNameLabel}
                    </label>
                    <input
                      id="customerName"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t.customerNamePlaceholder}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="invoiceDate" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                      {t.invoiceDateLabel}
                    </label>
                    <div className="relative">
                      <input
                        id="invoiceDate"
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Advance Payment Info */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Receipt size={20} className="text-gray-400" />
                    {t.advanceInfo}
                  </h2>
                </div>
                
                <div className="p-6">
                  {advances.length > 0 && (
                    <div className="space-y-3 mb-6">
                      <ul className="space-y-3">
                        {advances.map(adv => (
                          <li key={adv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{formatDate(adv.date)}</h4>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                              <div className="w-28 text-right font-semibold text-gray-900">
                                {formatCurrency(adv.amount)}
                              </div>
                              
                              <button 
                                onClick={() => removeAdvance(adv.id)}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                aria-label="Remove advance"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className={advances.length > 0 ? "pt-6 border-t border-gray-100" : ""}>
                    <form onSubmit={addAdvance} className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="newAdvanceDate" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            {t.advanceDateLabel}
                          </label>
                          <div className="relative">
                            <input
                              id="newAdvanceDate"
                              type="date"
                              value={newAdvanceDate}
                              onChange={(e) => setNewAdvanceDate(e.target.value)}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="newAdvanceAmount" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            {t.advanceAmountLabel}
                          </label>
                          <input
                            id="newAdvanceAmount"
                            type="text"
                            value={newAdvanceAmount}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              if (val) {
                                setNewAdvanceAmount(new Intl.NumberFormat('vi-VN').format(parseInt(val, 10)));
                              } else {
                                setNewAdvanceAmount('');
                              }
                            }}
                            placeholder="0"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                        >
                          <Plus size={18} />
                          {t.addAdvanceBtn}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* Products List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Receipt size={20} className="text-gray-400" />
                    {t.ordersByDate}
                  </h2>
                </div>
                
                <div className="p-6">
                  {groupedItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>{t.noOrders}</p>
                    </div>
                  ) : (
                    <div className="space-y-8 mb-8">
                      {groupedItems.map(group => (
                        <div key={group.date} className="space-y-3">
                          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                            <Calendar size={16} className="text-blue-500" />
                            {formatDate(group.date)}
                          </h3>
                          <ul className="space-y-3">
                            {group.items.map(item => (
                              <li key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{item.name}</h4>
                                  <p className="text-sm text-gray-500">{formatCurrency(item.price)} {t.each}</p>
                                </div>
                                
                                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                  <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm">
                                    <button 
                                      onClick={() => updateQuantity(item.id, -1)}
                                      className="px-3 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-l-lg transition-colors"
                                    >
                                      -
                                    </button>
                                    <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                                    <button 
                                      onClick={() => updateQuantity(item.id, 1)}
                                      className="px-3 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-r-lg transition-colors"
                                    >
                                      +
                                    </button>
                                  </div>
                                  
                                  <div className="w-28 text-right font-semibold text-gray-900">
                                    {formatCurrency(item.price * item.quantity)}
                                  </div>
                                  
                                  <button 
                                    onClick={() => removeItem(item.id)}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    aria-label="Remove item"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">{t.addNewOrder}</h3>
                    <form onSubmit={addItem} className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="itemDate" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{t.orderDate}</label>
                          <input
                            id="itemDate"
                            type="date"
                            value={newItemDate}
                            onChange={(e) => setNewItemDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="itemName" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{t.productNameLabel}</label>
                          <input
                            id="itemName"
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={t.productNamePlaceholder}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="w-full sm:w-1/2">
                          <label htmlFor="itemPrice" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{t.priceLabel}</label>
                          <input
                            id="itemPrice"
                            type="text"
                            value={formatPriceInput(newItemPrice)}
                            onChange={handlePriceChange}
                            placeholder="100.000"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            required
                          />
                        </div>
                        <div className="w-full sm:w-1/4">
                          <label htmlFor="itemQty" className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{t.quantityLabel}</label>
                          <input
                            id="itemQty"
                            type="number"
                            min="1"
                            value={newItemQuantity}
                            onChange={(e) => setNewItemQuantity(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            required
                          />
                        </div>
                        <button 
                          type="submit"
                          className="w-full sm:w-1/4 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 h-[46px]"
                        >
                          <Plus size={18} />
                          {t.addBtn}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Summary */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-8">
                <div className="p-6 border-b border-gray-100 bg-gray-900 text-white">
                  <h2 className="text-lg font-semibold mb-4">{t.invoiceSummary}</h2>
                  <div className="text-3xl font-light tracking-tight mb-1 break-words">
                    {formatCurrency(total)}
                  </div>
                  <div className="text-gray-400 text-sm">{t.totalDue}</div>
                </div>
                
                <div className="p-6 space-y-6 bg-gray-50">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-sm text-gray-500">{t.subtotal}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                    </div>
                    {advances.length > 0 && (
                      <div className="space-y-2">
                        {advances.map(adv => (
                          <div key={adv.id} className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-sm text-gray-500">
                              {t.advanceAmountLabel.split(' (')[0]} ({formatDate(adv.date)})
                            </span>
                            <span className="font-medium text-red-600">-{formatCurrency(adv.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <span className="block text-xs text-gray-500 uppercase tracking-wider mb-1">{t.billedTo}</span>
                      <div className="font-medium text-gray-900">{customerName || '—'}</div>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 uppercase tracking-wider mb-1">{t.invoiceDateLabel.replace('2. ', '')}</span>
                      <div className="font-medium text-gray-900">
                        {formatDate(invoiceDate)}
                      </div>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 uppercase tracking-wider mb-1">{t.totalProductTypes}</span>
                      <div className="font-medium text-gray-900">
                        {new Set(items.map(item => item.name.trim().toLowerCase())).size}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-200">
                    <button
                      onClick={saveInvoice}
                      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Save size={18} />
                      {currentInvoiceId ? t.updateInvoice : t.saveInvoice}
                    </button>
                    {currentInvoiceId && (
                      <button
                        onClick={createNewInvoice}
                        className="w-full mt-3 py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Plus size={18} />
                        {t.startNew}
                      </button>
                    )}
                    <button
                      onClick={() => setShowPreview(true)}
                      className="w-full mt-3 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Eye size={18} />
                      {t.exportImage}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sync Settings Modal */}
      {showSyncSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <RefreshCw size={20} className="text-blue-600" />
                {lang === 'en' ? 'Sync Across Devices' : 'Đồng bộ giữa các thiết bị'}
              </h3>
              <button onClick={() => setShowSyncSettings(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                {lang === 'en' 
                  ? 'Use this unique key to access your invoices on other devices. No login required!' 
                  : 'Sử dụng mã duy nhất này để truy cập hóa đơn của bạn trên các thiết bị khác. Không cần đăng nhập!'}
              </p>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {lang === 'en' ? 'Your Sync Key' : 'Mã đồng bộ của bạn'}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={tempSyncKey}
                      onChange={(e) => setTempSyncKey(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    />
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(syncKey);
                      showToast(lang === 'en' ? 'Key copied!' : 'Đã sao chép mã!');
                    }}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-gray-600"
                    title="Copy Key"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>{lang === 'en' ? 'How it works:' : 'Cách hoạt động:'}</strong><br />
                  {lang === 'en' 
                    ? '1. Copy this key. 2. Open this app on another device. 3. Paste the key here and click Update.' 
                    : '1. Sao chép mã này. 2. Mở ứng dụng này trên thiết bị khác. 3. Dán mã vào đây và nhấn Cập nhật.'}
                </p>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowSyncSettings(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                {lang === 'en' ? 'Cancel' : 'Hủy'}
              </button>
              <button
                onClick={handleUpdateSyncKey}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                {lang === 'en' ? 'Update Key' : 'Cập nhật Mã'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t.deleteConfirm}</h3>
            <p className="text-gray-500 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setInvoiceToDelete(null)} 
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                onClick={executeDelete} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <Save size={18} className="text-green-400" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Eye className="text-green-600" />
                {t.exportImage}
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleCopyImage}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors shadow-sm"
                >
                  <Copy size={18} />
                  <span className="hidden sm:inline">{t.copyImage}</span>
                </button>
                <button 
                  onClick={handleSaveImage}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">{t.downloadImage}</span>
                </button>
                <button 
                  onClick={() => setShowPreview(false)} 
                  className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-8 overflow-auto bg-white">
              <div className="min-w-[800px] mx-auto flex justify-center">
                <div id="export-table-container" className="bg-white p-4 sm:p-8 w-[800px]">
                <table className="w-full border-collapse border border-black text-black font-sans text-lg">
                  <thead>
                    <tr>
                      <th colSpan={5} className="border border-black text-center py-3 text-2xl font-bold bg-white">
                        {customerName || t.unnamedClient}
                      </th>
                    </tr>
                    <tr className="bg-white">
                      <th className="border border-black px-4 py-2 font-bold">{t.colDate}</th>
                      <th className="border border-black px-4 py-2 font-bold">{t.colProduct}</th>
                      <th className="border border-black px-4 py-2 font-bold">{t.colQty}</th>
                      <th className="border border-black px-4 py-2 font-bold">{t.colPrice}</th>
                      <th className="border border-black px-4 py-2 font-bold">{t.colTotal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedItems.map((group) => {
                      return group.items.map((item, index) => {
                        const globalIndex = flattenedItems.findIndex(i => i.id === item.id);
                        const isEven = globalIndex % 2 === 0;
                        return (
                          <tr key={item.id} className={isEven ? 'bg-[#E0E0E0]' : 'bg-white'}>
                            {index === 0 && (
                              <td 
                                rowSpan={group.items.length} 
                                className="border border-black px-4 py-2 text-center align-top bg-white"
                              >
                                {formatExportDate(group.date)}
                              </td>
                            )}
                            <td className="border border-black px-4 py-2">{item.name}</td>
                            <td className="border border-black px-4 py-2 text-center">{item.quantity}</td>
                            <td className="border border-black px-4 py-2">
                              <div className="flex justify-between w-full">
                                <span>$</span>
                                <span>{new Intl.NumberFormat('vi-VN').format(item.price)}</span>
                              </div>
                            </td>
                            <td className="border border-black px-4 py-2">
                              <div className="flex justify-between w-full">
                                <span>$</span>
                                <span>{new Intl.NumberFormat('vi-VN').format(item.price * item.quantity)}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="border border-black text-center font-bold py-2 text-lg">
                        {t.subtotal}
                      </td>
                      <td className="border border-black px-4 py-2 font-bold text-lg">
                        <div className="flex justify-between w-full">
                          <span>$</span>
                          <span>{new Intl.NumberFormat('vi-VN').format(subtotal)}</span>
                        </div>
                      </td>
                    </tr>
                    {advances.length > 0 && advances.map(adv => (
                      <tr key={adv.id}>
                        <td colSpan={4} className="border border-black text-center font-bold py-2 text-lg">
                          {t.advanceAmountLabel.split(' (')[0]} ({formatExportDate(adv.date)})
                        </td>
                        <td className="border border-black px-4 py-2 text-red-600 font-bold text-lg">
                          <div className="flex justify-between w-full">
                            <span>-$</span>
                            <span>{new Intl.NumberFormat('vi-VN').format(adv.amount)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-white">
                      <td colSpan={4} className="border border-black text-center text-red-600 font-bold py-3 text-xl">
                        {t.totalDue}
                      </td>
                      <td className="border border-black px-4 py-3 text-red-600 font-bold text-xl">
                        <div className="flex justify-between w-full">
                          <span>$</span>
                          <span>{new Intl.NumberFormat('vi-VN').format(total)}</span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
