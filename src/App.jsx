import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  LayoutGrid, List, Tags, PieChart as PieIcon, Plus, Pencil, Trash2,
  Search, X, ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown,
  Receipt, AlertCircle, Check, RotateCcw, ArrowUpDown, Lock} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import {
  loadTransactions,
  loadCategories,
  loadSaldoAwal,
  seedUserData,
  insertTransaction,
  updateTransactionDb,
  deleteTransactionDb,
  clearUserTransactions,
  saveCategories,
  saveSaldoAwal,
} from "./lib/dataService";
import SubscriptionBanner from "./components/SubscriptionBanner";
import BudgetPanel from "./components/BudgetPanel";
import { getUserPlanInfo, countTxThisMonth } from "./lib/planAccess";
import { exportTransactionsCsv, exportSummaryCsv } from "./lib/exportCsv";
import { exportElementAsPng } from "./lib/exportImage";

/* ---------------------------------------------------------------
   Seed data — imported from the user's existing spreadsheet
   (Juli 2025 s/d Agustus 2026), auto-dikategorikan saat impor.
------------------------------------------------------------------*/
export const SEED_TRANSACTIONS = [
  {id:1,date:'2025-07-01',type:'income',category:'Freelance',amount:8000,description:'Shope',note:'',method:''},
  {id:2,date:'2025-07-01',type:'income',category:'Freelance',amount:8600,description:'Grab',note:'',method:''},
  {id:3,date:'2025-07-01',type:'income',category:'Bonus',amount:1600,description:'Tip Dan Insentif',note:'',method:''},
  {id:4,date:'2025-07-01',type:'expense',category:'Lainnya',amount:45000,description:'Pengeluaran',note:'',method:''},
  {id:5,date:'2025-07-02',type:'income',category:'Freelance',amount:27200,description:'Shope',note:'',method:''},
  {id:6,date:'2025-07-02',type:'income',category:'Freelance',amount:111354,description:'Grab',note:'',method:''},
  {id:7,date:'2025-07-02',type:'income',category:'Bonus',amount:4480,description:'Tip Dan Insentif',note:'',method:''},
  {id:8,date:'2025-07-04',type:'income',category:'Freelance',amount:34400,description:'Shope',note:'',method:''},
  {id:9,date:'2025-07-04',type:'income',category:'Freelance',amount:87832,description:'Grab',note:'',method:''},
  {id:10,date:'2025-07-04',type:'income',category:'Bonus',amount:15000,description:'Tip Dan Insentif',note:'',method:''},
  {id:11,date:'2025-07-04',type:'expense',category:'Lainnya',amount:35000,description:'Pengeluaran',note:'',method:''},
  {id:12,date:'2025-07-05',type:'income',category:'Freelance',amount:51200,description:'Shope',note:'',method:''},
  {id:13,date:'2025-07-05',type:'income',category:'Freelance',amount:70960,description:'Grab',note:'',method:''},
  {id:14,date:'2025-07-05',type:'income',category:'Bonus',amount:15000,description:'Tip Dan Insentif',note:'',method:''},
  {id:15,date:'2025-07-05',type:'expense',category:'Lainnya',amount:40000,description:'Pengeluaran',note:'',method:''},
  {id:16,date:'2025-07-06',type:'income',category:'Freelance',amount:62600,description:'Shope',note:'',method:''},
  {id:17,date:'2025-07-06',type:'income',category:'Freelance',amount:70900,description:'Grab',note:'',method:''},
  {id:18,date:'2025-07-06',type:'income',category:'Bonus',amount:17000,description:'Tip Dan Insentif',note:'',method:''},
  {id:19,date:'2025-07-06',type:'expense',category:'Lainnya',amount:45000,description:'Pengeluaran',note:'',method:''},
  {id:20,date:'2025-07-11',type:'income',category:'Freelance',amount:8000,description:'Shope',note:'',method:''},
  {id:21,date:'2025-07-11',type:'income',category:'Freelance',amount:24600,description:'Grab',note:'',method:''},
  {id:22,date:'2025-07-11',type:'income',category:'Bonus',amount:1000,description:'Tip Dan Insentif',note:'',method:''},
  {id:23,date:'2025-07-12',type:'income',category:'Freelance',amount:27400,description:'Shope',note:'',method:''},
  {id:24,date:'2025-07-12',type:'income',category:'Freelance',amount:24000,description:'Grab',note:'',method:''},
  {id:25,date:'2025-07-12',type:'income',category:'Bonus',amount:2500,description:'Tip Dan Insentif',note:'',method:''},
  {id:26,date:'2025-07-12',type:'expense',category:'Lainnya',amount:45000,description:'Pengeluaran',note:'',method:''},
  {id:27,date:'2025-07-13',type:'income',category:'Freelance',amount:8000,description:'Shope',note:'',method:''},
  {id:28,date:'2025-07-13',type:'income',category:'Freelance',amount:83146,description:'Grab',note:'',method:''},
  {id:29,date:'2025-07-13',type:'income',category:'Bonus',amount:17000,description:'Tip Dan Insentif',note:'',method:''},
  {id:30,date:'2025-07-14',type:'income',category:'Freelance',amount:26400,description:'Shope',note:'',method:''},
  {id:31,date:'2025-07-14',type:'income',category:'Freelance',amount:92832,description:'Grab',note:'',method:''},
  {id:32,date:'2025-07-14',type:'income',category:'Bonus',amount:8000,description:'Tip Dan Insentif',note:'',method:''},
  {id:33,date:'2025-07-14',type:'expense',category:'Lainnya',amount:40000,description:'Pengeluaran',note:'',method:''},
  {id:34,date:'2025-07-15',type:'income',category:'Freelance',amount:13600,description:'Shope',note:'',method:''},
  {id:35,date:'2025-07-15',type:'income',category:'Freelance',amount:55000,description:'Grab',note:'',method:''},
  {id:36,date:'2025-07-15',type:'income',category:'Bonus',amount:2000,description:'Tip Dan Insentif',note:'',method:''},
  {id:37,date:'2025-07-15',type:'expense',category:'Lainnya',amount:35000,description:'Pengeluaran',note:'',method:''},
  {id:38,date:'2025-07-16',type:'income',category:'Freelance',amount:24800,description:'Shope',note:'',method:''},
  {id:39,date:'2025-07-16',type:'income',category:'Freelance',amount:111296,description:'Grab',note:'',method:''},
  {id:40,date:'2025-07-16',type:'income',category:'Bonus',amount:14000,description:'Tip Dan Insentif',note:'',method:''},
  {id:41,date:'2025-07-16',type:'expense',category:'Transportasi',amount:35000,description:'Next ganti oli 23200km',note:'',method:''},
  {id:42,date:'2025-07-17',type:'income',category:'Freelance',amount:8000,description:'Shope',note:'',method:''},
  {id:43,date:'2025-07-17',type:'income',category:'Freelance',amount:79900,description:'Grab',note:'',method:''},
  {id:44,date:'2025-07-17',type:'income',category:'Bonus',amount:2000,description:'Tip Dan Insentif',note:'',method:''},
  {id:45,date:'2025-07-18',type:'income',category:'Freelance',amount:8800,description:'Shope',note:'',method:''},
  {id:46,date:'2025-07-18',type:'income',category:'Freelance',amount:97928,description:'Grab',note:'',method:''},
  {id:47,date:'2025-07-18',type:'income',category:'Bonus',amount:13000,description:'Tip Dan Insentif',note:'',method:''},
  {id:48,date:'2025-07-18',type:'expense',category:'Lainnya',amount:50000,description:'Pengeluaran',note:'',method:''},
  {id:49,date:'2025-12-05',type:'income',category:'Gaji',amount:3600000,description:'Gaji',note:'',method:''},
  {id:50,date:'2025-12-07',type:'income',category:'Freelance',amount:28000,description:'Shope',note:'',method:''},
  {id:51,date:'2025-12-07',type:'income',category:'Freelance',amount:9500,description:'Grab',note:'',method:''},
  {id:52,date:'2025-12-07',type:'income',category:'Bonus',amount:6200,description:'Tip Dan Insentif',note:'',method:''},
  {id:53,date:'2025-12-08',type:'income',category:'Freelance',amount:7200,description:'Shope',note:'',method:''},
  {id:54,date:'2025-12-08',type:'income',category:'Freelance',amount:10700,description:'Grab',note:'',method:''},
  {id:55,date:'2025-12-08',type:'income',category:'Bonus',amount:2000,description:'Tip Dan Insentif',note:'',method:''},
  {id:56,date:'2026-01-01',type:'income',category:'Freelance',amount:28800,description:'Shope',note:'',method:''},
  {id:57,date:'2026-01-01',type:'income',category:'Freelance',amount:13700,description:'Grab',note:'',method:''},
  {id:58,date:'2026-01-01',type:'income',category:'Bonus',amount:2000,description:'Tip Dan Insentif',note:'',method:''},
  {id:59,date:'2026-01-02',type:'income',category:'Freelance',amount:16000,description:'Shope',note:'',method:''},
  {id:60,date:'2026-01-05',type:'income',category:'Gaji',amount:3750000,description:'Gaji',note:'',method:''},
  {id:61,date:'2026-02-01',type:'income',category:'Freelance',amount:46300,description:'Ojek Online',note:'',method:''},
  {id:62,date:'2026-02-01',type:'expense',category:'Belanja',amount:538683,description:'Belanja Bulanan Shopee + Potong rambut',note:'',method:''},
  {id:63,date:'2026-02-05',type:'income',category:'Bonus',amount:135000,description:'Ot Dan Tip',note:'',method:''},
  {id:64,date:'2026-02-05',type:'income',category:'Gaji',amount:3400000,description:'Gaji',note:'',method:''},
  {id:65,date:'2026-02-05',type:'expense',category:'Makanan & Minuman',amount:575000,description:'JAJAN+ BENG-BENG + ibu',note:'',method:''},
  {id:66,date:'2026-02-06',type:'expense',category:'Transportasi',amount:50000,description:'Bensin',note:'',method:''},
  {id:67,date:'2026-02-08',type:'expense',category:'Makanan & Minuman',amount:165000,description:'Sevis + jajan',note:'',method:''},
  {id:68,date:'2026-02-09',type:'expense',category:'Lainnya',amount:67500,description:'AIR + MIE',note:'',method:''},
  {id:69,date:'2026-02-10',type:'expense',category:'Lainnya',amount:50000,description:'ROTI',note:'',method:''},
  {id:70,date:'2026-02-11',type:'expense',category:'Transportasi',amount:50000,description:'BENSIN',note:'',method:''},
  {id:71,date:'2026-02-12',type:'expense',category:'Tagihan',amount:190000,description:'WIFI',note:'',method:''},
  {id:72,date:'2026-02-14',type:'expense',category:'Makanan & Minuman',amount:15000,description:'KOPI',note:'',method:''},
  {id:73,date:'2026-03-04',type:'expense',category:'Transportasi',amount:50000,description:'BENSIN',note:'',method:''},
  {id:74,date:'2026-03-05',type:'income',category:'Gaji',amount:5192000,description:'Gaji',note:'',method:''},
  {id:75,date:'2026-03-05',type:'expense',category:'Lainnya',amount:1050000,description:'SIM+ IBU',note:'',method:''},
  {id:76,date:'2026-03-08',type:'income',category:'Freelance',amount:53600,description:'Ojek Online',note:'',method:''},
  {id:77,date:'2026-03-08',type:'income',category:'Bonus',amount:15000,description:'Ot Dan Tip',note:'',method:''},
  {id:78,date:'2026-03-08',type:'expense',category:'Transportasi',amount:142000,description:'BENSIN+ROTI+BEBEK',note:'',method:''},
  {id:79,date:'2026-03-11',type:'income',category:'Freelance',amount:31200,description:'Ojek Online',note:'',method:''},
  {id:80,date:'2026-03-11',type:'income',category:'Bonus',amount:700,description:'Ot Dan Tip',note:'',method:''},
  {id:81,date:'2026-03-14',type:'income',category:'Freelance',amount:23200,description:'Ojek Online',note:'',method:''},
  {id:82,date:'2026-03-14',type:'income',category:'Bonus',amount:1500,description:'Ot Dan Tip',note:'',method:''},
  {id:83,date:'2026-03-18',type:'income',category:'Freelance',amount:55200,description:'Ojek Online',note:'',method:''},
  {id:84,date:'2026-03-18',type:'income',category:'Bonus',amount:3000,description:'Ot Dan Tip',note:'',method:''},
  {id:85,date:'2026-03-18',type:'expense',category:'Transportasi',amount:57000,description:'Bensin + Tahu tek',note:'',method:''},
  {id:86,date:'2026-03-19',type:'income',category:'Freelance',amount:39100,description:'Ojek Online',note:'',method:''},
  {id:87,date:'2026-03-19',type:'income',category:'Bonus',amount:7200,description:'Ot Dan Tip',note:'',method:''},
  {id:88,date:'2026-03-19',type:'expense',category:'Lainnya',amount:72000,description:'onde-onde',note:'',method:''},
  {id:89,date:'2026-03-20',type:'expense',category:'Transportasi',amount:9000,description:'parkir + beng-beng',note:'',method:''},
  {id:90,date:'2026-03-21',type:'income',category:'Freelance',amount:83200,description:'Ojek Online',note:'',method:''},
  {id:91,date:'2026-03-21',type:'income',category:'Bonus',amount:17000,description:'Ot Dan Tip',note:'',method:''},
  {id:92,date:'2026-03-21',type:'expense',category:'Transportasi',amount:50000,description:'Bensin',note:'',method:''},
  {id:93,date:'2026-03-22',type:'income',category:'Freelance',amount:106000,description:'Ojek Online',note:'',method:''},
  {id:94,date:'2026-03-22',type:'income',category:'Bonus',amount:12000,description:'Ot Dan Tip',note:'',method:''},
  {id:95,date:'2026-03-22',type:'expense',category:'Makanan & Minuman',amount:45000,description:'rujak',note:'',method:''},
  {id:96,date:'2026-03-23',type:'income',category:'Freelance',amount:77100,description:'Ojek Online',note:'',method:''},
  {id:97,date:'2026-03-23',type:'income',category:'Bonus',amount:7500,description:'Ot Dan Tip',note:'',method:''},
  {id:98,date:'2026-03-24',type:'expense',category:'Makanan & Minuman',amount:25000,description:'jajan',note:'',method:''},
  {id:99,date:'2026-03-25',type:'expense',category:'Tagihan',amount:35000,description:'Paket Data',note:'',method:''},
  {id:100,date:'2026-03-26',type:'expense',category:'Tagihan',amount:34000,description:'Paket Data',note:'',method:''},
  {id:101,date:'2026-03-27',type:'expense',category:'Transportasi',amount:56000,description:'bensin+beng-beng',note:'',method:''},
  {id:102,date:'2026-04-01',type:'expense',category:'Lainnya',amount:50000,description:'KONDANGAN',note:'',method:''},
  {id:103,date:'2026-04-02',type:'expense',category:'Transportasi',amount:50000,description:'Bensin',note:'',method:''},
  {id:104,date:'2026-04-03',type:'expense',category:'Lainnya',amount:175000,description:'Parfum+Kondangan',note:'',method:''},
  {id:105,date:'2026-04-04',type:'expense',category:'Lainnya',amount:56000,description:'tahu lontong + bengbeng',note:'',method:''},
  {id:106,date:'2026-04-05',type:'income',category:'Bonus',amount:120000,description:'Ot Dan Tip',note:'',method:''},
  {id:107,date:'2026-04-05',type:'income',category:'Gaji',amount:4119006,description:'Gaji',note:'',method:''},
  {id:108,date:'2026-04-05',type:'expense',category:'Makanan & Minuman',amount:1252053,description:'makan+ ibuk + pentol bakar + beli kebutuhan rumah',note:'',method:''},
  {id:109,date:'2026-04-07',type:'expense',category:'Transportasi',amount:64540,description:'bensin+shope',note:'',method:''},
  {id:110,date:'2026-04-09',type:'expense',category:'Belanja',amount:344790,description:'bayar pantai+shope',note:'',method:''},
  {id:111,date:'2026-04-10',type:'expense',category:'Belanja',amount:100000,description:'belanja',note:'',method:''},
  {id:112,date:'2026-04-12',type:'expense',category:'Makanan & Minuman',amount:204000,description:'jajan pantai',note:'',method:''},
  {id:113,date:'2026-04-13',type:'expense',category:'Transportasi',amount:234000,description:'wifi+servis',note:'',method:''},
  {id:114,date:'2026-04-14',type:'expense',category:'Transportasi',amount:89000,description:'bensin +  susu',note:'Next ganti oli 32.200km',method:''},
  {id:115,date:'2026-04-15',type:'expense',category:'Tagihan',amount:39812,description:'paket data',note:'',method:''},
  {id:116,date:'2026-04-19',type:'expense',category:'Lainnya',amount:91640,description:'baterai hp',note:'',method:''},
  {id:117,date:'2026-04-20',type:'expense',category:'Transportasi',amount:99000,description:'bensin+mie',note:'',method:''},
  {id:118,date:'2026-04-21',type:'expense',category:'Lainnya',amount:116382,description:'LCD hp full set',note:'',method:''},
  {id:119,date:'2026-04-24',type:'expense',category:'Makanan & Minuman',amount:13000,description:'Kopi + Dancow',note:'',method:''},
  {id:120,date:'2026-04-25',type:'income',category:'Freelance',amount:54400,description:'Ojek Online',note:'',method:''},
  {id:121,date:'2026-04-25',type:'income',category:'Bonus',amount:1400,description:'Ot Dan Tip',note:'',method:''},
  {id:122,date:'2026-04-25',type:'expense',category:'Transportasi',amount:55000,description:'bensin+ pentol',note:'',method:''},
  {id:123,date:'2026-04-26',type:'expense',category:'Tagihan',amount:35000,description:'paket data',note:'',method:''},
  {id:124,date:'2026-04-30',type:'expense',category:'Belanja',amount:50000,description:'beli dvn',note:'',method:''},
  {id:125,date:'2026-05-01',type:'expense',category:'Makanan & Minuman',amount:84500,description:'Beli Rujak + Jajan Buat ke pantai',note:'',method:''},
  {id:126,date:'2026-05-02',type:'expense',category:'Belanja',amount:73000,description:'Iuran+Beli Sosis',note:'',method:''},
  {id:127,date:'2026-05-03',type:'expense',category:'Belanja',amount:10000,description:'beli Pentol',note:'',method:''},
  {id:128,date:'2026-05-04',type:'expense',category:'Makanan & Minuman',amount:9000,description:'Beli jus',note:'',method:''},
  {id:129,date:'2026-05-05',type:'income',category:'Gaji',amount:4984339,description:'Gaji',note:'',method:''},
  {id:130,date:'2026-05-05',type:'expense',category:'Makanan & Minuman',amount:977700,description:'Untuk Ibu, Beli Obat, Takzia, Jajan',note:'',method:''},
  {id:131,date:'2026-05-07',type:'expense',category:'Tagihan',amount:14970,description:'pulsa',note:'',method:''},
  {id:132,date:'2026-05-08',type:'expense',category:'Makanan & Minuman',amount:10000,description:'jajan',note:'',method:''},
  {id:133,date:'2026-05-09',type:'income',category:'Freelance',amount:63700,description:'Ojek Online',note:'',method:''},
  {id:134,date:'2026-05-09',type:'income',category:'Bonus',amount:19000,description:'Ot Dan Tip',note:'',method:''},
  {id:135,date:'2026-05-09',type:'expense',category:'Transportasi',amount:60000,description:'Bensin+Jajan',note:'',method:''},
  {id:136,date:'2026-05-10',type:'expense',category:'Makanan & Minuman',amount:162000,description:'Sevis HP + Jajan',note:'',method:''},
  {id:137,date:'2026-05-12',type:'expense',category:'Tagihan',amount:44910,description:'pulsa',note:'',method:''},
  {id:138,date:'2026-05-13',type:'expense',category:'Tagihan',amount:110000,description:'wifi+nanas',note:'',method:''},
  {id:139,date:'2026-05-15',type:'expense',category:'Transportasi',amount:50000,description:'bensin',note:'',method:''},
  {id:140,date:'2026-05-16',type:'expense',category:'Makanan & Minuman',amount:7000,description:'Dancow Coklat',note:'',method:''},
  {id:141,date:'2026-05-17',type:'expense',category:'Makanan & Minuman',amount:17000,description:'jajan',note:'',method:''},
  {id:142,date:'2026-05-18',type:'expense',category:'Lainnya',amount:38000,description:'susu',note:'',method:''},
  {id:143,date:'2026-05-22',type:'expense',category:'Transportasi',amount:50000,description:'bensin',note:'',method:''},
  {id:144,date:'2026-05-23',type:'expense',category:'Makanan & Minuman',amount:22000,description:'dancow + potong',note:'',method:''},
  {id:145,date:'2026-05-24',type:'income',category:'Freelance',amount:47700,description:'Ojek Online',note:'',method:''},
  {id:146,date:'2026-05-24',type:'income',category:'Bonus',amount:7000,description:'Ot Dan Tip',note:'',method:''},
  {id:147,date:'2026-05-24',type:'expense',category:'Makanan & Minuman',amount:10000,description:'jajan',note:'',method:''},
  {id:148,date:'2026-05-25',type:'expense',category:'Lainnya',amount:11000,description:'mie ayam',note:'',method:''},
  {id:149,date:'2026-06-01',type:'expense',category:'Makanan & Minuman',amount:118040,description:'Paket Data + Jajan',note:'',method:''},
  {id:150,date:'2026-06-05',type:'income',category:'Bonus',amount:135000,description:'Ot Dan Tip',note:'',method:''},
  {id:151,date:'2026-06-05',type:'income',category:'Gaji',amount:4984339,description:'Gaji',note:'',method:''},
  {id:152,date:'2026-06-05',type:'expense',category:'Transportasi',amount:850000,description:'Bensin+ Ibu',note:'',method:''},
  {id:153,date:'2026-06-06',type:'income',category:'Freelance',amount:65500,description:'Ojek Online',note:'',method:''},
  {id:154,date:'2026-06-06',type:'income',category:'Bonus',amount:12500,description:'Ot Dan Tip',note:'',method:''},
  {id:155,date:'2026-06-06',type:'expense',category:'Belanja',amount:137200,description:'belanja shope',note:'',method:''},
  {id:156,date:'2026-06-07',type:'expense',category:'Transportasi',amount:339000,description:'dp servis + sikat gigi',note:'',method:''},
  {id:157,date:'2026-06-08',type:'expense',category:'Transportasi',amount:15000,description:'bensin',note:'',method:''},
  {id:158,date:'2026-06-09',type:'expense',category:'Lainnya',amount:270000,description:'sevis',note:'',method:''},
  {id:159,date:'2026-06-11',type:'expense',category:'Transportasi',amount:45000,description:'bensin',note:'',method:''},
  {id:160,date:'2026-06-12',type:'expense',category:'Tagihan',amount:90000,description:'wifi',note:'',method:''},
  {id:161,date:'2026-06-14',type:'expense',category:'Kesehatan',amount:37450,description:'sikat gigi',note:'Next ganti oli 34.200km',method:''},
  {id:162,date:'2026-06-15',type:'expense',category:'Makanan & Minuman',amount:52000,description:'jajan',note:'',method:''},
  {id:163,date:'2026-06-17',type:'expense',category:'Makanan & Minuman',amount:7000,description:'dancow',note:'',method:''},
  {id:164,date:'2026-06-19',type:'expense',category:'Transportasi',amount:55000,description:'bensin + jajan',note:'',method:''},
  {id:165,date:'2026-06-21',type:'income',category:'Freelance',amount:29000,description:'Ojek Online',note:'',method:''},
  {id:166,date:'2026-06-21',type:'income',category:'Bonus',amount:5500,description:'Ot Dan Tip',note:'',method:''},
  {id:167,date:'2026-06-21',type:'expense',category:'Makanan & Minuman',amount:26000,description:'Jus + Dancow + Gacoan',note:'',method:''},
  {id:168,date:'2026-06-22',type:'expense',category:'Lainnya',amount:281468,description:'Sepatu',note:'',method:''},
  {id:169,date:'2026-06-24',type:'income',category:'Freelance',amount:20700,description:'Ojek Online',note:'',method:''},
  {id:170,date:'2026-06-24',type:'expense',category:'Transportasi',amount:50000,description:'bensin',note:'',method:''},
  {id:171,date:'2026-06-27',type:'income',category:'Freelance',amount:22500,description:'Ojek Online',note:'',method:''},
  {id:172,date:'2026-06-27',type:'expense',category:'Tagihan',amount:52000,description:'badminton + paket data',note:'',method:''},
  {id:173,date:'2026-06-28',type:'income',category:'Freelance',amount:40700,description:'Ojek Online',note:'',method:''},
  {id:174,date:'2026-06-28',type:'income',category:'Bonus',amount:3500,description:'Ot Dan Tip',note:'',method:''},
  {id:175,date:'2026-06-28',type:'expense',category:'Transportasi',amount:38000,description:'Bensin',note:'',method:''},
  {id:176,date:'2026-06-29',type:'income',category:'Freelance',amount:20900,description:'Ojek Online',note:'',method:''},
  {id:177,date:'2026-06-29',type:'income',category:'Bonus',amount:2000,description:'Ot Dan Tip',note:'',method:''},
  {id:178,date:'2026-06-29',type:'expense',category:'Investasi',amount:59150,description:'Emas Digital',note:'',method:''},
  {id:179,date:'2026-06-30',type:'expense',category:'Lainnya',amount:48500,description:'Lemineral',note:'',method:''},
  {id:180,date:'2026-07-01',type:'expense',category:'Makanan & Minuman',amount:7000,description:'Dancow',note:'',method:''},
  {id:181,date:'2026-07-02',type:'expense',category:'Makanan & Minuman',amount:22000,description:'Jajan',note:'',method:''},
  {id:182,date:'2026-07-03',type:'income',category:'Freelance',amount:42200,description:'Ojek Online',note:'',method:''},
  {id:183,date:'2026-07-03',type:'expense',category:'Transportasi',amount:35000,description:'Bensin',note:'',method:''},
  {id:184,date:'2026-07-04',type:'expense',category:'Makanan & Minuman',amount:206000,description:'Jajan',note:'',method:''},
  {id:185,date:'2026-07-05',type:'income',category:'Freelance',amount:34400,description:'Ojek Online',note:'',method:''},
  {id:186,date:'2026-07-05',type:'income',category:'Bonus',amount:105000,description:'Ot Dan Tip',note:'',method:''},
  {id:187,date:'2026-07-05',type:'income',category:'Gaji',amount:4984339,description:'Gaji',note:'',method:''},
  {id:188,date:'2026-07-05',type:'expense',category:'Transportasi',amount:847000,description:'bensin + ibu',note:'',method:''},
  {id:189,date:'2026-07-06',type:'expense',category:'Lainnya',amount:65000,description:'Parfum',note:'',method:''},
  {id:190,date:'2026-07-07',type:'expense',category:'Belanja',amount:459745,description:'shope',note:'',method:''},
  {id:191,date:'2026-07-08',type:'expense',category:'Investasi',amount:193620,description:'emas digital',note:'',method:''},
  {id:192,date:'2026-07-09',type:'expense',category:'Makanan & Minuman',amount:44018,description:'shope + kopi',note:'',method:''},
  {id:193,date:'2026-07-10',type:'expense',category:'Transportasi',amount:50000,description:'bensin + bunga',note:'',method:''},
  {id:194,date:'2026-07-11',type:'expense',category:'Makanan & Minuman',amount:125000,description:'Peralatan ikan + Jus',note:'',method:''},
  {id:195,date:'2026-07-12',type:'expense',category:'Tagihan',amount:195963,description:'Peralatan ikan + Wifi+ sol sepatu',note:'',method:''},
  {id:196,date:'2026-07-14',type:'expense',category:'Transportasi',amount:131000,description:'Bensin+ Jajan + Pakan ikan',note:'Next ganti oli 34.200km',method:''},
  {id:197,date:'2026-07-15',type:'income',category:'Freelance',amount:10300,description:'Ojek Online',note:'',method:''},
  {id:198,date:'2026-07-15',type:'expense',category:'Lainnya',amount:28100,description:'sampo',note:'',method:''},
  {id:199,date:'2026-07-16',type:'expense',category:'Makanan & Minuman',amount:15000,description:'JAJAN',note:'',method:''},
  {id:200,date:'2026-07-17',type:'expense',category:'Transportasi',amount:89500,description:'Bensin+jajan',note:'',method:''},
  {id:201,date:'2026-07-18',type:'expense',category:'Investasi',amount:22470,description:'emas digital',note:'',method:''},
  {id:202,date:'2026-07-19',type:'income',category:'Freelance',amount:8000,description:'Ojek Online',note:'',method:''},
  {id:203,date:'2026-07-23',type:'expense',category:'Transportasi',amount:50000,description:'bensin',note:'',method:''},
  {id:204,date:'2026-07-25',type:'expense',category:'Lainnya',amount:35000,description:'Pengeluaran',note:'',method:''},
  {id:205,date:'2026-07-26',type:'expense',category:'Makanan & Minuman',amount:29679,description:'emas digital + DANCOW',note:'',method:''},
  {id:206,date:'2026-07-27',type:'expense',category:'Transportasi',amount:50000,description:'bensin',note:'',method:''},
  {id:207,date:'2026-07-30',type:'expense',category:'Makanan & Minuman',amount:10000,description:'makan',note:'',method:''},
  {id:208,date:'2026-07-31',type:'expense',category:'Makanan & Minuman',amount:15000,description:'makan',note:'',method:''},
  {id:209,date:'2026-08-01',type:'expense',category:'Transportasi',amount:75000,description:'Bensin + Jus',note:'',method:''},
  {id:210,date:'2026-08-02',type:'income',category:'Freelance',amount:16000,description:'Ojek Online',note:'',method:''},
  {id:211,date:'2026-08-02',type:'income',category:'Bonus',amount:1000,description:'Ot Dan Tip',note:'',method:''},
  {id:212,date:'2026-08-02',type:'expense',category:'Belanja',amount:29800,description:'Beli emas',note:'',method:''},
  {id:213,date:'2026-08-05',type:'income',category:'Bonus',amount:75000,description:'Ot Dan Tip',note:'',method:''},
  {id:214,date:'2026-08-05',type:'income',category:'Gaji',amount:4984339,description:'Gaji',note:'',method:''},
  {id:215,date:'2026-08-05',type:'expense',category:'Transportasi',amount:1008614,description:'Beli emas, ibu , bensin , paket data, shopee, makan',note:'',method:''},
  {id:216,date:'2026-08-06',type:'expense',category:'Transportasi',amount:359900,description:'Shope, Servis, sembako+ paket data',note:'',method:''},
  {id:217,date:'2026-08-07',type:'expense',category:'Belanja',amount:181440,description:'shope, sodaqo',note:'',method:''},
  {id:218,date:'2026-08-08',type:'expense',category:'Transportasi',amount:271763,description:'shope, bensin',note:'',method:''},
  {id:219,date:'2026-08-09',type:'expense',category:'Makanan & Minuman',amount:497430,description:'Beli emas, Klinik gigi, Beli Buah, Jajan',note:'',method:''},
  {id:220,date:'2026-08-11',type:'expense',category:'Belanja',amount:30288,description:'Shope',note:'',method:''},
  {id:221,date:'2026-08-12',type:'expense',category:'Tagihan',amount:80000,description:'wifi',note:'',method:''},
  {id:222,date:'2026-08-13',type:'income',category:'Bonus',amount:112162,description:'Ot Dan Tip',note:'',method:''},
  {id:223,date:'2026-08-13',type:'expense',category:'Transportasi',amount:50000,description:'bensin',note:'',method:''},
  {id:224,date:'2026-08-14',type:'expense',category:'Makanan & Minuman',amount:20000,description:'pisang',note:'Next ganti oli 36.000km',method:''},
  {id:225,date:'2026-08-15',type:'income',category:'Freelance',amount:28000,description:'Ojek Online',note:'',method:''},
  {id:226,date:'2026-08-15',type:'expense',category:'Belanja',amount:50000,description:'beli bunga',note:'',method:''},
  {id:227,date:'2026-08-16',type:'income',category:'Freelance',amount:55500,description:'Ojek Online',note:'',method:''},
  {id:228,date:'2026-08-16',type:'expense',category:'Makanan & Minuman',amount:32000,description:'rujak + Dancow',note:'',method:''},
  {id:229,date:'2026-08-17',type:'income',category:'Freelance',amount:50100,description:'Ojek Online',note:'',method:''},
  {id:230,date:'2026-08-17',type:'expense',category:'Transportasi',amount:50000,description:'Bensin',note:'',method:''},
  {id:231,date:'2026-08-19',type:'expense',category:'Makanan & Minuman',amount:15000,description:'telo',note:'',method:''},
  {id:232,date:'2026-08-22',type:'expense',category:'Transportasi',amount:71500,description:'bensin + keperlluan pantai',note:'',method:''},
  {id:233,date:'2026-08-23',type:'expense',category:'Hiburan',amount:117000,description:'pantai',note:'',method:''},
  {id:234,date:'2026-08-25',type:'expense',category:'Belanja',amount:28044,description:'shopee',note:'',method:''},
  {id:235,date:'2026-08-27',type:'expense',category:'Transportasi',amount:50000,description:'bensin',note:'',method:''},
  {id:236,date:'2026-08-28',type:'expense',category:'Lainnya',amount:15000,description:'tambal ban',note:'',method:''},
  {id:237,date:'2026-08-29',type:'expense',category:'Makanan & Minuman',amount:19000,description:'Jajan',note:'',method:''},
  {id:238,date:'2026-08-31',type:'expense',category:'Transportasi',amount:180730,description:'Shope + bensin',note:'',method:''},
];
export const DEFAULT_CATEGORIES = {
  income: ["Gaji", "Bonus", "Freelance", "Penjualan", "Investasi", "Lainnya"],
  expense: [
    "Makanan & Minuman", "Transportasi", "Tagihan", "Belanja", "Hiburan",
    "Kesehatan", "Pendidikan", "Cicilan", "Investasi", "Lainnya",
  ],
};

const PAYMENT_METHODS = ["Tunai", "Transfer Bank", "E-Wallet", "Kartu Debit", "Kartu Kredit", "Lainnya"];

const STORAGE_KEYS = {
  transactions: "bukukas:transactions",
  categories: "bukukas:categories",
  saldoAwal: "bukukas:saldo-awal",
};

const CAT_COLORS = [
  "#C9A24B", "#7FA37F", "#B5654F", "#6E8FA8", "#A6845C",
  "#8D7BAE", "#5F9E8F", "#C77B54", "#7A8C4E", "#B08AA6",
];
function colorForCategory(name, list) {
  const idx = list.indexOf(name);
  return CAT_COLORS[(idx >= 0 ? idx : 0) % CAT_COLORS.length];
}

const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const shortRupiah = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + " M";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " jt";
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + " rb";
  return String(n);
};

const fmtDateLong = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const MONTH_LABEL = (key) => {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function inRange(dateISO, filter, customFrom, customTo) {
  const d = new Date(dateISO + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  switch (filter) {
    case "today": {
      return dateISO === todayISO();
    }
    case "week": {
      const sw = startOfWeek(now);
      const ew = new Date(sw); ew.setDate(ew.getDate() + 6);
      return d >= sw && d <= ew;
    }
    case "month":
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    case "year":
      return d.getFullYear() === now.getFullYear();
    case "custom": {
      if (!customFrom && !customTo) return true;
      if (customFrom && d < new Date(customFrom + "T00:00:00")) return false;
      if (customTo && d > new Date(customTo + "T00:00:00")) return false;
      return true;
    }
    default:
      return true;
  }
}

let nextIdCounter = 100000;
function nextId() { return nextIdCounter++; }

/* ---------------------------------------------------------------
   Global styling — "night ledger": deep ink-green paper, brass
   accent for money-in, warm clay for money-out, serif numerals.
------------------------------------------------------------------*/
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');

      .bk-root {
        --ink: #EDEAE0;
        --ink-dim: #A9B0A8;
        --paper: #16231F;
        --paper-raised: #1D2E28;
        --paper-line: #2B3E37;
        --brass: #C9A24B;
        --brass-soft: rgba(201,162,75,0.14);
        --clay: #C4735A;
        --clay-soft: rgba(196,115,90,0.14);
        --sage: #7FA37F;
        font-family: 'Inter', system-ui, sans-serif;
        background: var(--paper);
        color: var(--ink);
        min-height: 100%;
        width: 100%;
      }
      .bk-serif { font-family: 'Source Serif 4', Georgia, serif; }
      .bk-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

      .bk-card {
        background: var(--paper-raised);
        border: 1px solid var(--paper-line);
        border-radius: 10px;
      }
      .bk-btn {
        display: inline-flex; align-items: center; gap: 6px;
        border-radius: 8px; font-weight: 500; font-size: 13.5px;
        padding: 8px 14px; border: 1px solid transparent; cursor: pointer;
        transition: background .15s, border-color .15s, opacity .15s;
        font-family: 'Inter', sans-serif;
      }
      .bk-btn-primary { background: var(--brass); color: #1B160A; }
      .bk-btn-primary:hover { opacity: .9; }
      .bk-btn-ghost { background: transparent; color: var(--ink); border-color: var(--paper-line); }
      .bk-btn-ghost:hover { background: var(--paper-line); }
      .bk-btn-danger { background: transparent; color: var(--clay); border-color: var(--clay); }
      .bk-btn-danger:hover { background: var(--clay-soft); }

      .bk-input, .bk-select {
        background: var(--paper); border: 1px solid var(--paper-line); color: var(--ink);
        border-radius: 7px; padding: 8px 10px; font-size: 13.5px; font-family: 'Inter', sans-serif;
        width: 100%; outline: none;
      }
      .bk-input:focus, .bk-select:focus { border-color: var(--brass); }
      .bk-input::placeholder { color: var(--ink-dim); }
      .bk-label { font-size: 12px; color: var(--ink-dim); margin-bottom: 4px; display: block; }

      .bk-tab {
        display: flex; align-items: center; gap: 9px; padding: 10px 14px;
        border-radius: 8px; cursor: pointer; font-size: 14px; color: var(--ink-dim);
        transition: background .15s, color .15s;
      }
      .bk-tab:hover { background: var(--paper-line); color: var(--ink); }
      .bk-tab-active { background: var(--brass-soft); color: var(--brass); font-weight: 600; }

      .bk-badge-in { background: var(--brass-soft); color: var(--brass); border-radius: 999px; padding: 2px 9px; font-size: 12px; font-weight: 600; }
      .bk-badge-out { background: var(--clay-soft); color: var(--clay); border-radius: 999px; padding: 2px 9px; font-size: 12px; font-weight: 600; }

      .bk-row:hover { background: rgba(255,255,255,0.02); }
      .bk-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
      .bk-scroll::-webkit-scrollbar-thumb { background: var(--paper-line); border-radius: 4px; }

      .bk-modal-overlay {
        position: fixed; inset: 0; background: rgba(8,12,10,0.6);
        display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px;
      }
      .bk-toast {
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: var(--paper-raised); border: 1px solid var(--paper-line); color: var(--ink);
        padding: 10px 16px; border-radius: 8px; font-size: 13.5px; z-index: 60;
        display: flex; align-items: center; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      }
      @media (max-width: 820px) {
        .bk-sidebar { display: none !important; }
        .bk-mobile-tabs { display: flex !important; }
      }
    `}</style>
  );
}

function StatCard({ label, value, icon: Icon, tone = "neutral", sub }) {
  const toneColor = tone === "up" ? "var(--brass)" : tone === "down" ? "var(--clay)" : "var(--ink)";
  return (
    <div className="bk-card" style={{ padding: "16px 18px", flex: "1 1 180px", minWidth: 160 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{label}</span>
        {Icon && <Icon size={16} color={toneColor} />}
      </div>
      <div className="bk-mono bk-serif" style={{ fontSize: 21, fontWeight: 600, color: toneColor, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PeriodFilter({ value, onChange, customFrom, customTo, onCustomFrom, onCustomTo }) {
  const opts = [
    ["today", "Hari ini"], ["week", "Minggu ini"], ["month", "Bulan ini"],
    ["year", "Tahun ini"], ["custom", "Custom"], ["all", "Semua"],
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {opts.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className="bk-btn"
          style={{
            background: value === k ? "var(--brass-soft)" : "var(--paper)",
            color: value === k ? "var(--brass)" : "var(--ink-dim)",
            border: "1px solid " + (value === k ? "var(--brass)" : "var(--paper-line)"),
            fontSize: 12.5, padding: "6px 12px",
          }}>
          {label}
        </button>
      ))}
      {value === "custom" && (
        <>
          <input type="date" className="bk-input" style={{ width: 145 }} value={customFrom} onChange={(e) => onCustomFrom(e.target.value)} />
          <span style={{ color: "var(--ink-dim)", fontSize: 12 }}>s/d</span>
          <input type="date" className="bk-input" style={{ width: 145 }} value={customTo} onChange={(e) => onCustomTo(e.target.value)} />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Transaction add/edit modal with validation
------------------------------------------------------------------*/
function TransactionModal({ initial, categories, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || {
      date: todayISO(), type: "expense", category: "", amount: "",
      description: "", note: "", method: "",
    }
  );
  const [errors, setErrors] = useState({});

  const catList = categories[form.type] || [];

  useEffect(() => {
    if (!catList.includes(form.category)) {
      setForm((f) => ({ ...f, category: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  function validate() {
    const e = {};
    if (!form.date) e.date = "Tanggal wajib diisi.";
    if (!form.type) e.type = "Jenis transaksi wajib dipilih.";
    if (!form.category) e.category = "Kategori wajib dipilih.";
    if (!form.description || !form.description.trim()) e.description = "Deskripsi tidak boleh kosong.";
    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) e.amount = "Nominal wajib lebih dari 0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...form,
      id: initial ? initial.id : undefined,
      amount: Number(form.amount),
      description: form.description.trim(),
      note: (form.note || "").trim(),
    });
  }

  return (
    <div className="bk-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} className="bk-card" style={{ width: "100%", maxWidth: 440, padding: 22, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 className="bk-serif" style={{ fontSize: 18, margin: 0 }}>
            {initial ? "Edit transaksi" : "Tambah transaksi"}
          </h3>
          <button type="button" onClick={onClose} className="bk-btn bk-btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["expense", "income"].map((t) => (
            <button type="button" key={t} onClick={() => setForm((f) => ({ ...f, type: t }))}
              className="bk-btn" style={{
                flex: 1, justifyContent: "center",
                background: form.type === t ? (t === "income" ? "var(--brass-soft)" : "var(--clay-soft)") : "var(--paper)",
                color: form.type === t ? (t === "income" ? "var(--brass)" : "var(--clay)") : "var(--ink-dim)",
                border: "1px solid " + (form.type === t ? (t === "income" ? "var(--brass)" : "var(--clay)") : "var(--paper-line)"),
              }}>
              {t === "income" ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
              {t === "income" ? "Pemasukan" : "Pengeluaran"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label className="bk-label">Tanggal</label>
            <input type="date" className="bk-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            {errors.date && <FieldError msg={errors.date} />}
          </div>
          <div>
            <label className="bk-label">Nominal (Rp)</label>
            <input type="number" min="0" className="bk-input bk-mono" placeholder="0" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            {errors.amount && <FieldError msg={errors.amount} />}
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label className="bk-label">Kategori</label>
          <select className="bk-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">Pilih kategori…</option>
            {catList.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <FieldError msg={errors.category} />}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label className="bk-label">Deskripsi</label>
          <input className="bk-input" placeholder="cth. Makan siang, Gaji bulan ini…" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {errors.description && <FieldError msg={errors.description} />}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label className="bk-label">Metode pembayaran</label>
            <select className="bk-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="">(opsional)</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="bk-label">Catatan</label>
            <input className="bk-input" placeholder="(opsional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onClose} className="bk-btn bk-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Batal</button>
          <button type="submit" className="bk-btn bk-btn-primary" style={{ flex: 1, justifyContent: "center" }}>
            <Check size={15} /> Simpan
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldError({ msg }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--clay)", fontSize: 11.5, marginTop: 4 }}>
      <AlertCircle size={12} /> {msg}
    </div>
  );
}

function ConfirmDialog({ title, body, onConfirm, onClose }) {
  return (
    <div className="bk-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bk-card" style={{ width: "100%", maxWidth: 360, padding: 20 }}>
        <h3 className="bk-serif" style={{ fontSize: 16.5, marginTop: 0 }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.5 }}>{body}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} className="bk-btn bk-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Batal</button>
          <button onClick={onConfirm} className="bk-btn bk-btn-danger" style={{ flex: 1, justifyContent: "center", background: "var(--clay)", color: "#1B160A", border: "1px solid var(--clay)" }}>Hapus</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Transactions page — search, filter, sort, CRUD
------------------------------------------------------------------*/
function TransactionsPage({ transactions, categories, onAdd, onEdit, onDelete, canExport, onExportBlocked }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const allCats = [...categories.income, ...categories.expense];

  const filtered = useMemo(() => {
    let list = transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (catFilter !== "all" && t.category !== catFilter) return false;
      if (period !== "all" && !inRange(t.date, period, customFrom, customTo)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!t.description.toLowerCase().includes(q) && !(t.note || "").toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [transactions, typeFilter, catFilter, period, customFrom, customTo, query, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function handleExport() {
    if (!canExport) {
      if (onExportBlocked) onExportBlocked();
      return;
    }
    exportTransactionsCsv(filtered.length ? filtered : transactions);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h2 className="bk-serif" style={{ fontSize: 22, margin: 0 }}>Transaksi</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="bk-btn bk-btn-ghost" onClick={handleExport} title={canExport ? "Export CSV" : "Khusus Basic/Pro"}>
            Export CSV{!canExport ? " 🔒" : ""}
          </button>
          <button className="bk-btn bk-btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus size={16} /> Tambah transaksi
          </button>
        </div>
      </div>

      <div className="bk-card" style={{ padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--ink-dim)" }} />
            <input className="bk-input" style={{ paddingLeft: 30 }} placeholder="Cari deskripsi, catatan, kategori…"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="bk-select" style={{ width: 150 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Semua jenis</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>
          <select className="bk-select" style={{ width: 180 }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">Semua kategori</option>
            {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo} />
      </div>

      <div className="bk-card bk-scroll" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 680 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--paper-line)", textAlign: "left" }}>
              <Th onClick={() => toggleSort("date")} active={sortKey === "date"} dir={sortDir}>Tanggal</Th>
              <th style={thStyle}>Deskripsi</th>
              <th style={thStyle}>Kategori</th>
              <th style={thStyle}>Metode</th>
              <Th onClick={() => toggleSort("amount")} active={sortKey === "amount"} dir={sortDir} align="right">Nominal</Th>
              <th style={{ ...thStyle, textAlign: "center" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--ink-dim)" }}>Tidak ada transaksi yang cocok.</td></tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="bk-row" style={{ borderBottom: "1px solid var(--paper-line)" }}>
                <td style={{ ...tdStyle }} className="bk-mono">{fmtDateLong(t.date)}</td>
                <td style={tdStyle}>
                  <div>{t.description}</div>
                  {t.note && <div style={{ fontSize: 11.5, color: "var(--ink-dim)" }}>{t.note}</div>}
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "var(--paper-line)" }}>{t.category}</span>
                </td>
                <td style={{ ...tdStyle, color: "var(--ink-dim)" }}>{t.method || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "right" }} className="bk-mono">
                  <span className={t.type === "income" ? "bk-badge-in" : "bk-badge-out"}>
                    {t.type === "income" ? "+" : "−"}{rupiah(t.amount)}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <button className="bk-btn bk-btn-ghost" style={{ padding: 5 }} onClick={() => { setEditing(t); setModalOpen(true); }}><Pencil size={13} /></button>
                  <button className="bk-btn bk-btn-ghost" style={{ padding: 5, marginLeft: 4 }} onClick={() => setDeleting(t)}><Trash2 size={13} color="var(--clay)" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>{filtered.length} dari {transactions.length} transaksi</div>

      {modalOpen && (
        <TransactionModal
          initial={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSave={(t) => { editing ? onEdit(t) : onAdd(t); setModalOpen(false); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Hapus transaksi?"
          body={`"${deleting.description}" senilai ${rupiah(deleting.amount)} akan dihapus permanen.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => { onDelete(deleting.id); setDeleting(null); }}
        />
      )}
    </div>
  );
}

const thStyle = { padding: "10px 12px", fontSize: 12, color: "var(--ink-dim)", fontWeight: 500 };
const tdStyle = { padding: "10px 12px", verticalAlign: "top" };

function Th({ children, onClick, active, dir, align }) {
  return (
    <th style={{ ...thStyle, cursor: "pointer", textAlign: align || "left" }} onClick={onClick}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: active ? "var(--brass)" : "var(--ink-dim)" }}>
        {children} <ArrowUpDown size={11} style={{ opacity: active ? 1 : 0.4 }} />
      </span>
    </th>
  );
}

/* ---------------------------------------------------------------
   Category manager
------------------------------------------------------------------*/
function CategoriesPage({ categories, transactions, onChange, canEdit }) {
  const [newIncomeCat, setNewIncomeCat] = useState("");
  const [newExpenseCat, setNewExpenseCat] = useState("");
  const [editingKey, setEditingKey] = useState(null); // "type::name"
  const [editValue, setEditValue] = useState("");
  const [notice, setNotice] = useState("");

  function usageCount(type, name) {
    return transactions.filter((t) => t.type === type && t.category === name).length;
  }

  function guardEdit() {
    if (canEdit) return true;
    setNotice("Ubah kategori custom hanya untuk paket Basic/Pro. Silakan upgrade di menu Langganan.");
    return false;
  }

  function addCategory(type) {
    if (!guardEdit()) return;
    const name = (type === "income" ? newIncomeCat : newExpenseCat).trim();
    if (!name) return;
    if (categories[type].includes(name)) { setNotice("Kategori sudah ada."); return; }
    const next = { ...categories, [type]: [...categories[type], name] };
    onChange(next);
    type === "income" ? setNewIncomeCat("") : setNewExpenseCat("");
  }

  function removeCategory(type, name) {
    if (!guardEdit()) return;
    const count = usageCount(type, name);
    if (count > 0) { setNotice(`"${name}" dipakai di ${count} transaksi — pindahkan transaksinya dulu sebelum menghapus.`); return; }
    onChange({ ...categories, [type]: categories[type].filter((c) => c !== name) });
  }

  function startEdit(type, name) {
    if (!guardEdit()) return;
    setEditingKey(type + "::" + name);
    setEditValue(name);
  }

  function commitEdit(type, oldName) {
    if (!guardEdit()) return;
    const val = editValue.trim();
    setEditingKey(null);
    if (!val || val === oldName) return;
    if (categories[type].includes(val)) { setNotice("Nama kategori sudah dipakai."); return; }
    onChange({ ...categories, [type]: categories[type].map((c) => (c === oldName ? val : c)) });
  }

  const Column = ({ type, title, tone }) => (
    <div className="bk-card" style={{ padding: 16, flex: "1 1 280px" }}>
      <h3 className="bk-serif" style={{ fontSize: 16, margin: "0 0 12px" }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {categories[type].map((c) => (
          <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", background: "var(--paper)", borderRadius: 7 }}>
            {editingKey === type + "::" + c ? (
              <input autoFocus className="bk-input" style={{ padding: "4px 8px" }} value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit(type, c)}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(type, c); if (e.key === "Escape") setEditingKey(null); }} />
            ) : (
              <span style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: colorForCategory(c, categories[type]) }} />
                {c}
                <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>({usageCount(type, c)})</span>
              </span>
            )}
            <div style={{ display: "flex", gap: 2 }}>
              <button className="bk-btn bk-btn-ghost" style={{ padding: 4, opacity: canEdit ? 1 : 0.4 }} onClick={() => startEdit(type, c)} disabled={!canEdit}><Pencil size={12} /></button>
              <button className="bk-btn bk-btn-ghost" style={{ padding: 4, opacity: canEdit ? 1 : 0.4 }} onClick={() => removeCategory(type, c)} disabled={!canEdit}><Trash2 size={12} color="var(--clay)" /></button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input className="bk-input" placeholder={canEdit ? `Kategori ${title.toLowerCase()} baru…` : "Upgrade Basic/Pro untuk kategori custom"}
          value={type === "income" ? newIncomeCat : newExpenseCat}
          disabled={!canEdit}
          onChange={(e) => (type === "income" ? setNewIncomeCat(e.target.value) : setNewExpenseCat(e.target.value))}
          onKeyDown={(e) => { if (e.key === "Enter") addCategory(type); }} />
        <button className="bk-btn bk-btn-primary" onClick={() => addCategory(type)} disabled={!canEdit} style={{ opacity: canEdit ? 1 : 0.5 }}><Plus size={14} /></button>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="bk-serif" style={{ fontSize: 22, marginBottom: 16 }}>Kategori</h2>
      {!canEdit && (
        <div className="bk-card" style={{ padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--ink-dim)" }}>
          Paket <b>Gratis</b>: kategori bawaan bisa dipakai. Tambah/edit/hapus kategori custom tersedia di <b>Basic/Pro</b>.
        </div>
      )}
      {notice && (
        <div className="bk-card" style={{ padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, borderColor: "var(--clay)" }}>
          <AlertCircle size={15} color="var(--clay)" />
          <span style={{ fontSize: 13, flex: 1 }}>{notice}</span>
          <button className="bk-btn bk-btn-ghost" style={{ padding: 4 }} onClick={() => setNotice("")}><X size={13} /></button>
        </div>
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Column type="income" title="Pemasukan" />
        <Column type="expense" title="Pengeluaran" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Dashboard
------------------------------------------------------------------*/
function Dashboard({ transactions, categories, saldoAwal }) {
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filtered = useMemo(
    () => transactions.filter((t) => inRange(t.date, period, customFrom, customTo)),
    [transactions, period, customFrom, customTo]
  );

  const totalIncomeAll = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenseAll = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const saldo = saldoAwal + totalIncomeAll - totalExpenseAll;

  const incomeP = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenseP = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const selisih = incomeP - expenseP;

  // income vs expense per month (last 8 months present in data)
  const byMonth = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const key = t.date.slice(0, 7);
      if (!map[key]) map[key] = { key, income: 0, expense: 0 };
      map[key][t.type] += t.amount;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-8)
      .map((m) => ({ ...m, label: MONTH_LABEL(m.key) }));
  }, [transactions]);

  // expense by category (within current filter)
  const expenseByCat = useMemo(() => {
    const map = {};
    filtered.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // cumulative saldo growth over time
  const saldoGrowth = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    let running = saldoAwal;
    const map = {};
    sorted.forEach((t) => {
      running += t.type === "income" ? t.amount : -t.amount;
      map[t.date] = running;
    });
    return Object.entries(map).map(([date, saldo]) => ({ date: fmtDateLong(date).slice(0, 6), saldo }));
  }, [transactions, saldoAwal]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h2 className="bk-serif" style={{ fontSize: 22, margin: 0 }}>Dashboard</h2>
        <PeriodFilter value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total saldo" value={rupiah(saldo)} icon={Wallet} tone={saldo >= 0 ? "up" : "down"} sub="Saldo awal + seluruh transaksi" />
        <StatCard label="Pemasukan (periode)" value={rupiah(incomeP)} icon={ArrowUpCircle} tone="up" />
        <StatCard label="Pengeluaran (periode)" value={rupiah(expenseP)} icon={ArrowDownCircle} tone="down" />
        <StatCard label="Selisih (periode)" value={(selisih >= 0 ? "+" : "") + rupiah(selisih)} icon={selisih >= 0 ? TrendingUp : TrendingDown} tone={selisih >= 0 ? "up" : "down"} />
        <StatCard label="Jumlah transaksi" value={String(filtered.length)} icon={Receipt} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div className="bk-card" style={{ padding: 16, flex: "2 1 420px", minWidth: 320 }}>
          <h4 className="bk-serif" style={{ fontSize: 15, margin: "0 0 12px" }}>Pemasukan vs pengeluaran per bulan</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--ink-dim)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--ink-dim)" fontSize={11} tickFormatter={shortRupiah} tickLine={false} axisLine={false} width={54} />
              <Tooltip contentStyle={{ background: "#1D2E28", border: "1px solid #2B3E37", borderRadius: 8, fontSize: 12.5 }}
                formatter={(v) => rupiah(v)} labelStyle={{ color: "#EDEAE0" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Pemasukan" fill="#C9A24B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#C4735A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bk-card" style={{ padding: 16, flex: "1 1 280px", minWidth: 260 }}>
          <h4 className="bk-serif" style={{ fontSize: 15, margin: "0 0 12px" }}>Pengeluaran per kategori</h4>
          {expenseByCat.length === 0 ? (
            <div style={{ color: "var(--ink-dim)", fontSize: 13, padding: "30px 0", textAlign: "center" }}>Tidak ada pengeluaran di periode ini.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={expenseByCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {expenseByCat.map((entry, i) => (
                    <Cell key={entry.name} fill={colorForCategory(entry.name, categories.expense)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1D2E28", border: "1px solid #2B3E37", borderRadius: 8, fontSize: 12.5 }} formatter={(v) => rupiah(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6, maxHeight: 100, overflowY: "auto" }} className="bk-scroll">
            {expenseByCat.slice(0, 6).map((c) => (
              <div key={c.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: colorForCategory(c.name, categories.expense) }} />
                  {c.name}
                </span>
                <span className="bk-mono" style={{ color: "var(--ink-dim)" }}>{rupiah(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bk-card" style={{ padding: 16, marginTop: 14 }}>
        <h4 className="bk-serif" style={{ fontSize: 15, margin: "0 0 12px" }}>Perkembangan saldo</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={saldoGrowth.slice(-60)}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--ink-dim)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis stroke="var(--ink-dim)" fontSize={11} tickFormatter={shortRupiah} tickLine={false} axisLine={false} width={54} />
            <Tooltip contentStyle={{ background: "#1D2E28", border: "1px solid #2B3E37", borderRadius: 8, fontSize: 12.5 }} formatter={(v) => rupiah(v)} />
            <Line type="monotone" dataKey="saldo" stroke="#C9A24B" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Ringkasan Keuangan (summary / insights)
------------------------------------------------------------------*/
function SummaryPage({ transactions, categories, canExport, onExportBlocked }) {
  const captureRef = useRef(null);
  const [exportingImg, setExportingImg] = useState(false);

  const byMonth = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const key = t.date.slice(0, 7);
      if (!map[key]) map[key] = { key, income: 0, expense: 0, count: 0 };
      map[key][t.type] += t.amount;
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
  }, [transactions]);

  const currentMonthKey = todayISO().slice(0, 7);
  const currentMonthExpenses = transactions.filter((t) => t.type === "expense" && t.date.slice(0, 7) === currentMonthKey);
  const catTotalsThisMonth = {};
  currentMonthExpenses.forEach((t) => { catTotalsThisMonth[t.category] = (catTotalsThisMonth[t.category] || 0) + t.amount; });
  const topCatThisMonth = Object.entries(catTotalsThisMonth).sort((a, b) => b[1] - a[1])[0];

  const allExpenses = transactions.filter((t) => t.type === "expense");
  const totalExpenseAll = allExpenses.reduce((s, t) => s + t.amount, 0);
  const totalIncomeAll = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const avgExpense = allExpenses.length ? totalExpenseAll / allExpenses.length : 0;

  const catTotalsAll = {};
  allExpenses.forEach((t) => { catTotalsAll[t.category] = (catTotalsAll[t.category] || 0) + t.amount; });
  const topCatsAll = Object.entries(catTotalsAll).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const trend = byMonth.slice(0, 6).reverse().map((m) => ({ ...m, label: MONTH_LABEL(m.key), net: m.income - m.expense }));

  let insight = "Belum ada cukup data pengeluaran bulan ini untuk memberi insight.";
  if (topCatThisMonth) {
    insight = `Pengeluaran terbesar bulan ini berasal dari kategori ${topCatThisMonth[0]}, senilai ${rupiah(topCatThisMonth[1])}.`;
  }

  function handleExportSummary() {
    if (!canExport) {
      if (onExportBlocked) onExportBlocked();
      return;
    }
    exportSummaryCsv(transactions);
  }

  async function handleExportImage() {
    if (!canExport) {
      if (onExportBlocked) onExportBlocked();
      return;
    }
    try {
      setExportingImg(true);
      const stamp = new Date().toISOString().slice(0, 10);
      await exportElementAsPng(captureRef.current, `bukukas-ringkasan-${stamp}.png`);
    } catch (e) {
      console.error(e);
      alert("Gagal export gambar. Coba lagi.");
    } finally {
      setExportingImg(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h2 className="bk-serif" style={{ fontSize: 22, margin: 0 }}>Ringkasan keuangan</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-export-ignore="true">
          <button
            className="bk-btn bk-btn-ghost"
            onClick={handleExportSummary}
            title={canExport ? "Export ringkasan CSV" : "Khusus Basic/Pro"}
          >
            Export CSV{!canExport ? " 🔒" : ""}
          </button>
          <button
            className="bk-btn bk-btn-ghost"
            onClick={handleExportImage}
            disabled={exportingImg}
            title={canExport ? "Export ringkasan sebagai gambar PNG" : "Khusus Basic/Pro"}
          >
            {exportingImg ? "Menyimpan..." : `Export gambar${!canExport ? " 🔒" : ""}`}
          </button>
        </div>
      </div>

      <div ref={captureRef} style={{ background: "#16231F", padding: 8, borderRadius: 12 }}>
        <div className="bk-card" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start", borderColor: "var(--brass)" }}>
          <TrendingUp size={18} color="var(--brass)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{insight}</div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <StatCard label="Total pemasukan (semua waktu)" value={rupiah(totalIncomeAll)} tone="up" icon={ArrowUpCircle} />
          <StatCard label="Total pengeluaran (semua waktu)" value={rupiah(totalExpenseAll)} tone="down" icon={ArrowDownCircle} />
          <StatCard label="Rata-rata per transaksi keluar" value={rupiah(avgExpense)} icon={Receipt} />
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="bk-card" style={{ padding: 16, flex: "2 1 420px", minWidth: 320 }}>
            <h4 className="bk-serif" style={{ fontSize: 15, margin: "0 0 12px" }}>Tren 6 bulan terakhir</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--ink-dim)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--ink-dim)" fontSize={11} tickFormatter={shortRupiah} tickLine={false} axisLine={false} width={54} />
                <Tooltip contentStyle={{ background: "#1D2E28", border: "1px solid #2B3E37", borderRadius: 8, fontSize: 12.5 }} formatter={(v) => rupiah(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="income" name="Pemasukan" stroke="#C9A24B" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expense" name="Pengeluaran" stroke="#C4735A" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bk-card" style={{ padding: 16, flex: "1 1 260px", minWidth: 240 }}>
            <h4 className="bk-serif" style={{ fontSize: 15, margin: "0 0 12px" }}>5 kategori pengeluaran terbesar</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topCatsAll.map(([name, val]) => (
                <div key={name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span>{name}</span>
                    <span className="bk-mono" style={{ color: "var(--ink-dim)" }}>{rupiah(val)}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--paper)", borderRadius: 999 }}>
                    <div style={{ height: "100%", width: `${topCatsAll[0] && topCatsAll[0][1] ? (val / topCatsAll[0][1]) * 100 : 0}%`, background: colorForCategory(name, categories.expense), borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bk-card bk-scroll" style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--paper-line)", textAlign: "left" }}>
                <th style={thStyle}>Bulan</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Pemasukan</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Pengeluaran</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Selisih</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Transaksi</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => (
                <tr key={m.key} className="bk-row" style={{ borderBottom: "1px solid var(--paper-line)" }}>
                  <td style={tdStyle}>{MONTH_LABEL(m.key)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }} className="bk-mono">{rupiah(m.income)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }} className="bk-mono">{rupiah(m.expense)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }} className="bk-mono">
                    <span style={{ color: m.income - m.expense >= 0 ? "var(--brass)" : "var(--clay)" }}>{rupiah(m.income - m.expense)}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Main App
------------------------------------------------------------------*/
export default function App() {
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [planInfo, setPlanInfo] = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadUserData() {
      setLoaded(false);
      try {
        let txs = await loadTransactions(user.id);
        let cats = await loadCategories(user.id);
        let saldo = await loadSaldoAwal(user.id);

        // Transaksi boleh kosong — tidak seed data contoh
        if (!cats || (!(cats.income && cats.income.length) && !(cats.expense && cats.expense.length))) {
          await saveCategories(user.id, DEFAULT_CATEGORIES);
          cats = DEFAULT_CATEGORIES;
        }
        if (saldo == null) {
          saldo = 0;
          await saveSaldoAwal(user.id, 0);
        }

        if (cancelled) return;
        setTransactions(txs);
        setCategories(cats || DEFAULT_CATEGORIES);
        setSaldoAwal(saldo);
      } catch (e) {
        console.error("Gagal memuat data:", e);
        if (!cancelled) showToast("Gagal memuat data cloud");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadUserData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getUserPlanInfo(user.id).then(setPlanInfo).catch(console.error);
  }, [user, transactions.length]);

  async function addTransaction(t) {
    try {
      if (planInfo && planInfo.txLimitPerMonth != null) {
        const used = countTxThisMonth(transactions);
        if (used >= planInfo.txLimitPerMonth) {
          showToast(
            `Batas gratis ${planInfo.txLimitPerMonth} transaksi/bulan. Upgrade ke Basic/Pro.`
          );
          return;
        }
      }
      const saved = await insertTransaction(user.id, t);
      setTransactions((prev) => [saved, ...prev]);
      showToast("Transaksi ditambahkan.");
    } catch (e) {
      console.error(e);
      showToast("Gagal menyimpan transaksi");
    }
  }

  async function editTransaction(t) {
    try {
      await updateTransactionDb(user.id, t);
      setTransactions((prev) => prev.map((x) => (x.id === t.id ? t : x)));
      showToast("Transaksi diperbarui.");
    } catch (e) {
      console.error(e);
      showToast("Gagal memperbarui");
    }
  }

  async function deleteTransaction(id) {
    try {
      await deleteTransactionDb(user.id, id);
      setTransactions((prev) => prev.filter((x) => x.id !== id));
      showToast("Transaksi dihapus.");
    } catch (e) {
      console.error(e);
      showToast("Gagal menghapus");
    }
  }

  async function updateCategories(next) {
    try {
      if (planInfo && !planInfo.canUseCustomCategory) {
        showToast("Ubah kategori custom hanya untuk paket Basic/Pro. Silakan upgrade.");
        return;
      }
      await saveCategories(user.id, next);
      setCategories(next);
      showToast("Kategori diperbarui.");
    } catch (e) {
      console.error(e);
      showToast("Gagal simpan kategori");
    }
  }

  async function handleReset() {
    try {
      await clearUserTransactions(user.id);
      await saveCategories(user.id, DEFAULT_CATEGORIES);
      await saveSaldoAwal(user.id, 0);
      setTransactions([]);
      setCategories(DEFAULT_CATEGORIES);
      setSaldoAwal(0);
      showToast("Data dikosongkan.");
    } catch (e) {
      console.error(e);
      showToast("Gagal reset data");
    }
  }

  async function handleLogout() {
    await signOut();
    window.location.href = "/login";
  }

  const NAV = [
    ["dashboard", "Dashboard", LayoutGrid],
    ["transactions", "Transaksi", List],
    ["categories", "Kategori", Tags],
    ["summary", "Ringkasan", PieIcon],
  ];

  if (!loaded) {
    return (
      <div className="bk-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 400 }}>
        <GlobalStyle />
        <div style={{ color: "var(--ink-dim)", fontSize: 13.5 }}>Memuat data keuangan…</div>
      </div>
    );
  }

  return (
    <div className="bk-root" style={{ display: "flex", minHeight: "100%" }}>
      <GlobalStyle />

      <aside className="bk-sidebar" style={{ width: 210, borderRight: "1px solid var(--paper-line)", padding: 18, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--brass-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wallet size={16} color="var(--brass)" />
          </div>
          <span className="bk-serif" style={{ fontSize: 17, fontWeight: 600 }}>Buku Kas</span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map(([key, label, Icon]) => (
            <div key={key} className={"bk-tab" + (tab === key ? " bk-tab-active" : "")} onClick={() => setTab(key)}>
              <Icon size={16} /> {label}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
          <a href="/chat" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderRadius: 8, color: "var(--ink-dim)", textDecoration: "none", fontSize: 13,
          }}>Chat Admin</a>
          <a href="/complaints" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderRadius: 8, color: "var(--ink-dim)", textDecoration: "none", fontSize: 13,
          }}>Keluhan</a>
          <a href="/subscription" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderRadius: 8, color: "var(--ink-dim)", textDecoration: "none", fontSize: 13,
          }}>Langganan</a>
          {planInfo?.canUseProTools ? (
            <a href="/pro-tools" style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
              borderRadius: 8, color: "var(--ink-dim)", textDecoration: "none", fontSize: 13,
            }}>Tools Pro</a>
          ) : (
            <button
              type="button"
              onClick={() => {
                showToast("Tools Pro (wallet, utang, prediksi, PDF) khusus paket Pro. Silakan upgrade di Langganan.");
              }}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                borderRadius: 8, color: "var(--ink-dim)", fontSize: 13,
                background: "transparent", border: "none", cursor: "pointer",
                width: "100%", textAlign: "left", opacity: 0.75,
              }}
            >
              <Lock size={14} /> Tools Pro
            </button>
          )}
        </div>

        <div style={{ marginTop: 26, paddingTop: 16, borderTop: "1px solid var(--paper-line)" }}>
          <label className="bk-label">Saldo awal</label>
          <input
            type="number"
            className="bk-input bk-mono"
            value={saldoAwal}
            onChange={async (e) => {
              const v = Number(e.target.value) || 0;
              setSaldoAwal(v);
              try {
                await saveSaldoAwal(user.id, v);
              } catch (err) {
                console.error(err);
              }
            }}
          />
        </div>

        <button
          className="bk-btn bk-btn-ghost"
          style={{ marginTop: 16, width: "100%", justifyContent: "center", fontSize: 12 }}
          onClick={() => setConfirmReset(true)}
        >
          <RotateCcw size={13} /> Reset data
        </button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--paper-line)" }}>
          <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 8 }}>
            {profile?.full_name || profile?.email || user?.email || "User"}
            <br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>{profile?.role || "user"}</span>
          </div>
          <button
            className="bk-btn bk-btn-ghost"
            style={{ width: "100%", justifyContent: "center", fontSize: 12, color: "var(--clay)" }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <div
        className="bk-mobile-tabs"
        style={{
          display: "none",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: "var(--paper-raised)",
          borderTop: "1px solid var(--paper-line)",
          padding: "6px 8px",
          paddingBottom: "max(6px, env(safe-area-inset-bottom))",
        }}
      >
        {NAV.map(([key, label, Icon]) => (
          <div
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "8px 0",
              minHeight: 48,
              color: tab === key ? "var(--brass)" : "var(--ink-dim)",
              fontSize: 10.5,
              cursor: "pointer",
            }}
          >
            <Icon size={20} />
            {label}
          </div>
        ))}
        <a href="/chat" style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          gap: 2, padding: "8px 0", minHeight: 48, color: "var(--ink-dim)",
          fontSize: 10.5, textDecoration: "none",
        }}>Chat</a>
        <a href="/complaints" style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          gap: 2, padding: "8px 0", minHeight: 48, color: "var(--ink-dim)",
          fontSize: 10.5, textDecoration: "none",
        }}>Keluhan</a>
        <a href="/subscription" style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          gap: 2, padding: "8px 0", minHeight: 48, color: "var(--ink-dim)",
          fontSize: 10.5, textDecoration: "none",
        }}>Langganan</a>
        {planInfo?.canUseProTools ? (
          <a href="/pro-tools" style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 2, padding: "8px 0", minHeight: 48, color: "var(--ink-dim)",
            fontSize: 10.5, textDecoration: "none",
          }}>Pro</a>
        ) : (
          <button
            type="button"
            onClick={() => showToast("Tools Pro khusus paket Pro. Upgrade di Langganan.")}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 2, padding: "8px 0", minHeight: 48, color: "var(--ink-dim)",
              fontSize: 10.5, background: "transparent", border: "none", cursor: "pointer",
              opacity: 0.75,
            }}
          >
            <Lock size={16} />
            Pro
          </button>
        )}
      </div>

      <main style={{ flex: 1, padding: 22, paddingBottom: 70, maxWidth: 1180, margin: "0 auto", width: "100%" }}>
        <SubscriptionBanner transactions={transactions} />
        {tab === "dashboard" && (
          <>
            <BudgetPanel transactions={transactions} onToast={showToast} />
            <Dashboard transactions={transactions} categories={categories} saldoAwal={saldoAwal} />
          </>
        )}
        {tab === "transactions" && (
          <TransactionsPage
            transactions={transactions}
            categories={categories}
            onAdd={addTransaction}
            onEdit={editTransaction}
            onDelete={deleteTransaction}
            canExport={!!planInfo?.canUseExport}
            onExportBlocked={() =>
              showToast("Export CSV khusus paket Basic/Pro. Silakan upgrade di menu Langganan.")
            }
          />
        )}
        {tab === "categories" && (
          <CategoriesPage
            categories={categories}
            transactions={transactions}
            onChange={updateCategories}
            canEdit={!!planInfo?.canUseCustomCategory}
          />
        )}
        {tab === "summary" && (
          <SummaryPage
            transactions={transactions}
            categories={categories}
            canExport={!!planInfo?.canUseExport}
            onExportBlocked={() =>
              showToast("Export ringkasan khusus paket Basic/Pro. Silakan upgrade di menu Langganan.")
            }
          />
        )}
      </main>

      {toast && (
        <div className="bk-toast">
          <Check size={14} color="var(--brass)" />
          {toast}
        </div>
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Reset semua data?"
          body="Semua transaksi akan dihapus. Saldo awal jadi 0. Tidak mengembalikan data contoh."
          onClose={() => setConfirmReset(false)}
          onConfirm={async () => {
            setConfirmReset(false);
            await handleReset();
          }}
        />
      )}
    </div>
  );
}
