import { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── DATA ────────────────────────────────────────────────────────────────────

const USERS = [
  { id: "salman",    name: "Salman",    initials: "SA", color: "from-indigo-500 to-indigo-600" },
  { id: "farel",     name: "Farel",     initials: "FA", color: "from-emerald-500 to-emerald-600" },
  { id: "khaizuran", name: "Khaizuran", initials: "KH", color: "from-violet-500 to-violet-600" },
];

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

const INITIAL_SCHEDULE = {
  Senin: [
    { id: "s1", course: "Algoritma dan Struktur Data", sks: 3, kelas: "B", lecturer: "Dra. Sri Rezeki Candra N, M.Kom.", start: "08:01", end: "10:30", mode: "OFFLINE", room: "Lab A-301", link: "", changed: false },
    { id: "s2", course: "Interaksi Manusia-Komputer", sks: 2, kelas: "B", lecturer: "Bambang Riono Arsad", start: "10:31", end: "12:10", mode: "ONLINE", room: "", link: "https://meet.google.com/abc-defg-hij", changed: true },
  ],
  Selasa: [
    { id: "t1", course: "Interpersonal Skill", sks: 2, kelas: "B", lecturer: "Dr. Seta Ariawuri Wicaksana", start: "08:01", end: "09:40", mode: "OFFLINE", room: "Ruang B-205", link: "", changed: false },
    { id: "t2", course: "Kalkulus", sks: 3, kelas: "B", lecturer: "Ninuk Wiliani, Ph.D", start: "09:41", end: "12:10", mode: "OFFLINE", room: "Ruang B-101", link: "", changed: false },
    { id: "t3", course: "Fisika", sks: 2, kelas: "B", lecturer: "Dra. Sri Rezeki Candra N", start: "13:01", end: "14:40", mode: "ONLINE", room: "", link: "https://zoom.us/j/123456789", changed: true },
  ],
  Rabu: [
    { id: "r1", course: "Matematika Diskrit", sks: 3, kelas: "B", lecturer: "Prof. Dr. Dra. Andiani", start: "09:41", end: "12:10", mode: "OFFLINE", room: "Ruang C-301", link: "", changed: false },
  ],
  Kamis: [
    { id: "k1", course: "Pengantar Sistem Digital", sks: 2, kelas: "B", lecturer: "Dr. Ainil Syafitri", start: "08:01", end: "09:40", mode: "OFFLINE", room: "Lab E-201", link: "", changed: false },
    { id: "k2", course: "English for Academic Purpose", sks: 2, kelas: "A", lecturer: "Dr. Kartini Istikomah", start: "09:40", end: "11:20", mode: "OFFLINE", room: "Ruang D-102", link: "", changed: false },
    { id: "k3", course: "Sistem Operasi", sks: 2, kelas: "B", lecturer: "Bambang Riono Arsad", start: "11:21", end: "13:00", mode: "OFFLINE", room: "Lab A-202", link: "", changed: false },
    { id: "k4", course: "Prak. Algoritma dan Struktur Data", sks: 1, kelas: "B", lecturer: "Dra. Sri Rezeki Candra N", start: "13:00", end: "16:00", mode: "OFFLINE", room: "Lab Komputer F-101", link: "", changed: false },
  ],
  Jumat: [
    { id: "j1", course: "Sistem Informasi Manajemen", sks: 2, kelas: "B", lecturer: "Dr. Ir. Iman Paryudi", start: "08:01", end: "09:40", mode: "OFFLINE", room: "Ruang A-101", link: "", changed: false },
  ],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getDeadlineLabel(deadline) {
  const ts = deadline?.toDate ? deadline.toDate() : new Date(deadline);
  const diff = ts - Date.now();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return { label: "Terlambat!", color: "text-red-600 bg-red-50" };
  if (hours < 6) return { label: `Urgent: ${hours}j lagi`, color: "text-red-600 bg-red-50" };
  if (days < 1) return { label: `${hours}j lagi`, color: "text-orange-600 bg-orange-50" };
  if (days <= 3) return { label: `${days} hari lagi`, color: "text-amber-600 bg-amber-50" };
  return { label: `${days} hari lagi`, color: "text-slate-500 bg-slate-100" };
}

function getTodayDay() {
  const days = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  return days[new Date().getDay()];
}

function getUserColorKey(userId) {
  const u = USERS.find(x => x.id === userId);
  if (!u) return "indigo";
  if (u.color.includes("emerald")) return "emerald";
  if (u.color.includes("violet")) return "violet";
  return "indigo";
}

function Avatar({ user, size = "sm" }) {
  const u = USERS.find(x => x.id === user) || USERS[0];
  const sz = size === "sm" ? "w-6 h-6 text-xs" : size === "md" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${u.color} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {u.initials}
    </div>
  );
}

// ─── MODALS ──────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ChangeScheduleModal({ item, day, onSave, onClose }) {
  const [mode, setMode] = useState(item.mode);
  const [room, setRoom] = useState(item.room);
  const [link, setLink] = useState(item.link);
  const [start, setStart] = useState(item.start);
  const [end, setEnd] = useState(item.end);
  const [cancelled, setCancelled] = useState(item.cancelled || false);

  return (
    <Modal open onClose={onClose} title="Ubah Jadwal">
      <div className="space-y-4">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <p className="font-semibold text-indigo-800 text-sm">{item.course}</p>
          <p className="text-xs text-indigo-600">{day} • {item.start}–{item.end}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Mode Kelas</label>
          <div className="flex gap-2">
            {["OFFLINE", "ONLINE"].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${mode === m ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                {m === "OFFLINE" ? "🏫 Offline" : "💻 Online"}
              </button>
            ))}
          </div>
        </div>
        {mode === "OFFLINE" ? (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ruangan</label>
            <input value={room} onChange={e => setRoom(e.target.value)} placeholder="cth: Lab A-301"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Link Meeting</label>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://meet.google.com/..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        )}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Jam Mulai</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Jam Selesai</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={cancelled} onChange={e => setCancelled(e.target.checked)} className="w-4 h-4 accent-red-500" />
          <span className="text-sm text-red-600 font-medium">Batalkan kelas ini</span>
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Batal</button>
          <button onClick={() => onSave({ mode, room, link, start, end, cancelled, changed: true })}
            className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">Simpan Perubahan</button>
        </div>
      </div>
    </Modal>
  );
}

function AddTaskModal({ onSave, onClose }) {
  const [form, setForm] = useState({ course: "", title: "", desc: "", priority: "Medium", deadline: "", assignee: "salman" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = async () => {
    if (!form.title || !form.course) return;
    setSaving(true);
    await onSave({ ...form, deadline: form.deadline ? new Date(form.deadline) : new Date(Date.now() + 7 * 86400000), status: "Todo" });
    setSaving(false);
  };
  return (
    <Modal open onClose={onClose} title="Tambah Tugas Baru">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Mata Kuliah</label>
          <input value={form.course} onChange={e => set("course", e.target.value)} placeholder="cth: Algoritma dan Struktur Data"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Judul Tugas</label>
          <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Nama tugas..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
          <textarea value={form.desc} onChange={e => set("desc", e.target.value)} rows={2} placeholder="Detail tugas..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Prioritas</label>
            <select value={form.priority} onChange={e => set("priority", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Penanggung Jawab</label>
            <select value={form.assignee} onChange={e => set("assignee", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              {USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Deadline</label>
          <input type="datetime-local" value={form.deadline} onChange={e => set("deadline", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {saving ? "Menyimpan..." : "Tambah Tugas"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddNoteModal({ onSave, onClose, activeUser }) {
  const [form, setForm] = useState({ title: "", content: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    await onSave({
      ...form,
      date: new Date().toISOString().split("T")[0],
      author: USERS.find(u => u.id === activeUser)?.name || "Salman",
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      preview: form.content.slice(0, 100),
    });
    setSaving(false);
  };
  return (
    <Modal open onClose={onClose} title="Buat Catatan Baru">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Judul Catatan</label>
          <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="cth: Diskusi Proyek Akhir"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Isi Catatan</label>
          <textarea value={form.content} onChange={e => set("content", e.target.value)} rows={5} placeholder="• Tulis poin catatan di sini..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none font-mono" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Tags (pisah dengan koma)</label>
          <input value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="IMK, Proyek, UTS"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {saving ? "Menyimpan..." : "Simpan Catatan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── SCHEDULE CARD ────────────────────────────────────────────────────────────

function CourseCard({ item, day, onChangeSchedule }) {
  const isOnline = item.mode === "ONLINE";
  const isCancelled = item.cancelled;
  return (
    <div className={`relative rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-md ${isCancelled ? "border-red-200 bg-red-50 opacity-70" : item.changed ? "border-amber-300 bg-amber-50/50" : "border-slate-100 bg-white hover:border-indigo-200"}`}>
      {item.changed && !isCancelled && (
        <div className="absolute -top-2 left-4 px-2 py-0.5 bg-amber-400 text-white text-[10px] font-bold rounded-full">⚡ JADWAL BERUBAH</div>
      )}
      {isCancelled && (
        <div className="absolute -top-2 left-4 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">✕ DIBATALKAN</div>
      )}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm leading-snug ${isCancelled ? "line-through text-slate-400" : "text-slate-800"}`}>{item.course}</p>
          <p className="text-xs text-slate-400 mt-0.5">Dosen: {item.lecturer}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg ${isOnline ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {isOnline ? "🌐 ONLINE" : "🏫 OFFLINE"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-medium">⏰ {item.start}–{item.end}</span>
        <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg">{item.sks} SKS</span>
        <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg">Kelas {item.kelas}</span>
      </div>
      <div className="text-xs text-slate-500 mb-3">
        {isOnline ? (
          <a href={item.link} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
            🔗 Join Meeting <span className="text-[10px] underline">{item.link?.slice(0, 30)}...</span>
          </a>
        ) : (
          <span>📍 {item.room || "Ruangan TBD"}</span>
        )}
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button onClick={() => onChangeSchedule(item, day)}
          className="flex-1 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors">
          ✏️ Ubah Jadwal
        </button>
      </div>
    </div>
  );
}

// ─── SCHEDULE VIEW ────────────────────────────────────────────────────────────

function WeeklyCalendar({ schedule, onChangeSchedule }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {DAYS.map(day => (
        <div key={day}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold text-slate-700 text-sm">{day}</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">{schedule[day]?.length || 0} kelas</span>
          </div>
          <div className="space-y-3">
            {(schedule[day] || []).map(item => (
              <CourseCard key={item.id} item={item} day={day} onChangeSchedule={onChangeSchedule} />
            ))}
            {(!schedule[day] || schedule[day].length === 0) && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
                <p className="text-slate-400 text-xs">Tidak ada kelas</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TodayAgenda({ schedule, onChangeSchedule }) {
  const today = getTodayDay();
  const daySchedule = DAYS.includes(today) ? schedule[today] || [] : schedule["Senin"] || [];
  const displayDay = DAYS.includes(today) ? today : "Senin";
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-lg">📅</div>
        <div>
          <p className="font-bold text-slate-800">Hari Ini — {displayDay}</p>
          <p className="text-xs text-slate-500">{daySchedule.length} kelas terjadwal</p>
        </div>
      </div>
      {daySchedule.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">🎉</div>
          <p className="font-medium">Tidak ada kelas hari ini!</p>
          <p className="text-sm">Waktunya belajar mandiri atau istirahat.</p>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-6">
            {daySchedule.map((item) => (
              <div key={item.id} className="relative">
                <div className={`absolute -left-8 top-4 w-3 h-3 rounded-full border-2 border-white ${item.cancelled ? "bg-red-400" : item.changed ? "bg-amber-400" : "bg-indigo-500"}`} />
                <CourseCard item={item} day={displayDay} onChangeSchedule={onChangeSchedule} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TASK BOARD ────────────────────────────────────────────────────────────────

const priorityStyle = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-emerald-100 text-emerald-700",
};

function TaskCard({ task, onMove, onDelete }) {
  const dl = getDeadlineLabel(task.deadline);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityStyle[task.priority]}`}>{task.priority}</span>
        <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 text-xs transition-all">✕</button>
      </div>
      <p className="text-xs font-semibold text-indigo-600 mb-1">{task.course}</p>
      <p className="text-sm font-semibold text-slate-800 mb-1 leading-snug">{task.title}</p>
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{task.desc}</p>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${dl.color}`}>{dl.label}</span>
        <Avatar user={task.assignee} size="sm" />
      </div>
      <div className="flex gap-1 mt-3 pt-3 border-t border-slate-50">
        {task.status !== "Todo" && (
          <button onClick={() => onMove(task.id, task.status === "InProgress" ? "Todo" : "InProgress")}
            className="flex-1 text-[10px] py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors">← Kembali</button>
        )}
        {task.status !== "Completed" && (
          <button onClick={() => onMove(task.id, task.status === "Todo" ? "InProgress" : "Completed")}
            className="flex-1 text-[10px] py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors">Maju →</button>
        )}
      </div>
    </div>
  );
}

function TaskBoard({ tasks, onMove, onDelete }) {
  const cols = [
    { key: "Todo", label: "To-Do", icon: "📋", color: "text-slate-700", dot: "bg-slate-400" },
    { key: "InProgress", label: "In Progress", icon: "⚡", color: "text-amber-700", dot: "bg-amber-400" },
    { key: "Completed", label: "Selesai", icon: "✅", color: "text-emerald-700", dot: "bg-emerald-400" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cols.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key);
        return (
          <div key={col.key} className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className={`font-bold text-sm ${col.color}`}>{col.label}</span>
              <span className="ml-auto text-xs bg-white text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">{colTasks.length}</span>
            </div>
            <div className="space-y-3">
              {colTasks.map(t => (
                <TaskCard key={t.id} task={t} onMove={onMove} onDelete={onDelete} />
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Kosong</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── NOTES ────────────────────────────────────────────────────────────────────

function NotesSection({ notes, onDelete, onAddNote }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (notes.length > 0 && !selected) setSelected(notes[0]?.id);
  }, [notes]);

  const selectedNote = notes.find(n => n.id === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-700">Semua Catatan</span>
          <button onClick={onAddNote} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors">+ Baru</button>
        </div>
        {notes.map(note => (
          <button key={note.id} onClick={() => setSelected(note.id)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selected === note.id ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-white hover:border-slate-200"}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-semibold text-sm text-slate-800 leading-snug">{note.title}</p>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{note.date}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <Avatar user={USERS.find(u => u.name === note.author)?.id || "salman"} size="sm" />
              <span className="text-xs text-slate-500">oleh {note.author}</span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">{note.preview}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {note.tags?.map(tag => <span key={tag} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">{tag}</span>)}
            </div>
          </button>
        ))}
        {notes.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">Belum ada catatan</div>
        )}
      </div>
      <div className="lg:col-span-3">
        {selectedNote ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 h-full min-h-[300px]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{selectedNote.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Avatar user={USERS.find(u => u.name === selectedNote.author)?.id || "salman"} size="sm" />
                  <span className="text-xs text-slate-500">Notulensi oleh <strong>{selectedNote.author}</strong> · {selectedNote.date}</span>
                </div>
              </div>
              <button
                onClick={() => { onDelete(selectedNote.id); setSelected(null); }}
                className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">Hapus</button>
            </div>
            <div className="flex flex-wrap gap-1 mb-4">
              {selectedNote.tags?.map(tag => <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg font-medium">{tag}</span>)}
            </div>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4">{selectedNote.content}</pre>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-12 flex items-center justify-center">
            <p className="text-slate-400 text-sm text-center">Pilih catatan untuk membacanya</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QUICK LINKS ──────────────────────────────────────────────────────────────

function QuickLinks({ links, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", url: "", icon: "🔗" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.label || !form.url) return;
    setSaving(true);
    await onAdd({ ...form });
    setForm({ label: "", url: "", icon: "🔗" });
    setAdding(false);
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-slate-700">Quick Links Hub</span>
        <button onClick={() => setAdding(true)} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">+ Tambah</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {links.map(link => (
          <div key={link.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group">
            <span className="text-xl">{link.icon}</span>
            <a href={link.url} target="_blank" rel="noreferrer"
              className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 truncate flex-1">{link.label}</a>
            <button onClick={() => onDelete(link.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 text-xs transition-all flex-shrink-0">✕</button>
          </div>
        ))}
        {links.length === 0 && (
          <div className="col-span-2 rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Belum ada link</div>
        )}
      </div>
      {adding && (
        <Modal open onClose={() => setAdding(false)} title="Tambah Quick Link">
          <div className="space-y-3">
            <input value={form.label} onChange={e => setForm(f => ({...f, label: e.target.value}))} placeholder="Nama link"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <input value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} placeholder="https://..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <input value={form.icon} onChange={e => setForm(f => ({...f, icon: e.target.value}))} placeholder="Emoji icon"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm">Batal</button>
              <button onClick={handleAdd} disabled={saving}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60">
                {saving ? "Menyimpan..." : "Tambah"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────

function ActivityLog({ log }) {
  const colorMap = {
    indigo: "bg-indigo-100 text-indigo-700",
    emerald: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "baru saja";
    const ts = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    return `${days} hari lalu`;
  };

  return (
    <div>
      <p className="text-sm font-bold text-slate-700 mb-3">Log Aktivitas</p>
      <div className="space-y-2">
        {log.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Belum ada aktivitas</div>
        )}
        {log.map(a => (
          <div key={a.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100">
            <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${colorMap[a.color] || colorMap.indigo}`}>{a.user}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-600 leading-relaxed">{a.action}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(a.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-3xl mx-auto mb-4 animate-pulse">🎓</div>
        <p className="font-black text-slate-700 text-xl">Academic Hub</p>
        <p className="text-slate-400 text-sm mt-1">Memuat data dari Firestore...</p>
      </div>
    </div>
  );
}

// ─── AI CHATBOT ───────────────────────────────────────────────────────────────

function buildSystemPrompt({ schedule, tasks, notes, links, activeUser }) {
  const today = getTodayDay();
  const currentUser = USERS.find(u => u.id === activeUser);

  const scheduleText = DAYS.map(day => {
    const classes = (schedule[day] || []).map(c =>
      `  - ${c.course} (${c.start}–${c.end}, ${c.mode}, ${c.mode === "OFFLINE" ? c.room || "TBD" : c.link}, Dosen: ${c.lecturer}, SKS: ${c.sks})${c.cancelled ? " [DIBATALKAN]" : ""}${c.changed ? " [JADWAL BERUBAH]" : ""}`
    ).join("\n");
    return `${day}:\n${classes || "  - Tidak ada kelas"}`;
  }).join("\n");

  const formatDeadline = (dl) => {
    try {
      const ts = dl?.toDate ? dl.toDate() : new Date(dl);
      return ts.toLocaleString("id-ID");
    } catch { return "N/A"; }
  };

  const tasksText = tasks.length === 0 ? "Tidak ada tugas." : tasks.map(t =>
    `  - [${t.status}] "${t.title}" | Matkul: ${t.course} | Prioritas: ${t.priority} | Deadline: ${formatDeadline(t.deadline)} | Assignee: ${t.assignee}`
  ).join("\n");

  const notesText = notes.length === 0 ? "Tidak ada catatan." : notes.map(n =>
    `  - "${n.title}" oleh ${n.author} (${n.date}) | Tags: ${n.tags?.join(", ") || "-"}`
  ).join("\n");

  const linksText = links.length === 0 ? "Tidak ada link." : links.map(l =>
    `  - ${l.icon} ${l.label}: ${l.url}`
  ).join("\n");

  return `Kamu adalah Akademi, asisten AI cerdas dan ramah untuk aplikasi "Academic Hub" milik kelompok mahasiswa. Kamu berbicara dalam bahasa Indonesia yang santai, friendly, dan semangat — kayak teman kuliah yang helpful banget!

KONTEKS PENGGUNA AKTIF:
- Nama: ${currentUser?.name || "Unknown"}
- Hari ini: ${today}

DATA JADWAL KULIAH LENGKAP:
${scheduleText}

DATA TUGAS (TASKS):
${tasksText}

DATA CATATAN (NOTES):
${notesText}

QUICK LINKS:
${linksText}

INSTRUKSI PERILAKU:
1. Jawab pertanyaan tentang jadwal, tugas, catatan, dan data di atas dengan akurat.
2. Kalau ditanya "jadwal hari ini", cek hari "${today}" dari data jadwal.
3. Kalau ditanya tugas mendesak, cari task dengan status bukan "Completed" dan deadline terdekat.
4. Kamu boleh kasih saran produktivitas, tips belajar, atau motivasi kalau diminta.
5. Selalu responsif, singkat-padat, dan pakai emoji secukupnya biar lebih hidup! 🎯
6. Jangan keluar dari konteks data aplikasi ini — kamu adalah asisten khusus Academic Hub.`;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">🤖</div>
      <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-2 mb-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      style={{ animation: "chatMsgIn 0.25s ease-out both" }}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">🤖</div>
      )}
      <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
        isUser
          ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm"
          : "bg-white/80 backdrop-blur-sm border border-white/60 text-slate-700 rounded-bl-sm"
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

function Chatbot({ schedule, tasks, notes, links, activeUser }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Halo! 👋 Aku Akademi, asisten AI kamu di Academic Hub. Mau tanya soal jadwal, tugas, atau butuh bantuan apa nih? 😊" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key tidak ditemukan. Tambahkan VITE_GEMINI_API_KEY di file .env kamu.");

// Menggunakan SDK Resmi Google yang anti-error / jika goole tetap error maka arrow about der
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: buildSystemPrompt({ schedule, tasks, notes, links, activeUser })
      });

      // Menyusun riwayat chat agar AI ingat obrolan sebelumnya
      const history = messages.slice(1).map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      // Memulai sesi chat
      const chat = model.startChat({
        history: history,
        generationConfig: { temperature: 0.8 },
      });

      // Mengirim pesan
      const result = await chat.sendMessage(text);
      const aiText = result.response.text();

      setMessages(prev => [...prev, { role: "assistant", content: aiText }]);
    } catch (err) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan saat menghubungi AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes chatMsgIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatWindowIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fabPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%       { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
        }
        .chat-window-anim {
          animation: chatWindowIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .fab-pulse {
          animation: fabPulse 2.5s infinite;
        }
      `}</style>

      {/* Chat Window */}
      {open && (
        <div
          className="chat-window-anim fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] flex flex-col"
          style={{ height: "520px" }}
        >
          <div className="flex flex-col h-full rounded-3xl overflow-hidden shadow-2xl border border-white/40"
            style={{ background: "rgba(248,250,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/50"
              style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.95) 0%, rgba(139,92,246,0.95) 100%)", backdropFilter: "blur(10px)" }}>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🤖</div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Akademi AI</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <p className="text-white/80 text-[10px]">Online · Powered by Gemini 1.5 Flash</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs transition-colors">✕</button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ scrollbarWidth: "thin" }}>
              {messages.map((msg, i) => (
                <ChatMessage key={i} msg={msg} />
              ))}
              {loading && <TypingIndicator />}
              {error && (
                <div className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                  ⚠️ {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {["Jadwal hari ini 📅", "Tugas mendesak ⚡", "Berapa total SKS? 📚"].map(s => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors font-medium">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-white/50">
              <div className="flex items-end gap-2 bg-white/70 rounded-2xl border border-white/80 shadow-sm px-3 py-2"
                style={{ backdropFilter: "blur(10px)" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ketik pesan... (Enter untuk kirim)"
                  rows={1}
                  disabled={loading}
                  className="flex-1 text-sm text-slate-700 placeholder-slate-400 bg-transparent resize-none focus:outline-none leading-relaxed disabled:opacity-50"
                  style={{ maxHeight: "80px", overflowY: "auto" }}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-md">
                  {loading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-1.5">Shift+Enter untuk baris baru</p>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center text-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${open ? "bg-slate-700 rotate-12" : "bg-gradient-to-br from-indigo-500 to-violet-600 fab-pulse"}`}
        title="Chat dengan AI"
      >
        {open ? "✕" : "✨"}
        {!open && messages.length > 1 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {messages.filter(m => m.role === "assistant").length - 1}
          </span>
        )}
      </button>
    </>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function AcademicHub() {
  const [activeUser, setActiveUser] = useState("salman");
  const [activeSection, setActiveSection] = useState("schedule");
  const [scheduleView, setScheduleView] = useState("weekly");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncPulse, setSyncPulse] = useState(false);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // ── Firebase state ──
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [links, setLinks] = useState([]);
  const [activity, setActivity] = useState([]);

  // Modals
  const [changeModal, setChangeModal] = useState(null);
  const [addTaskModal, setAddTaskModal] = useState(false);
  const [addNoteModal, setAddNoteModal] = useState(false);

  // ── Clock ──
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Real-time listeners ──
  useEffect(() => {
    const unsubs = [];

    const tasksQ = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    unsubs.push(onSnapshot(tasksQ, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    const notesQ = query(collection(db, "notes"), orderBy("createdAt", "desc"));
    unsubs.push(onSnapshot(notesQ, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    const linksQ = query(collection(db, "links"), orderBy("createdAt", "asc"));
    unsubs.push(onSnapshot(linksQ, (snap) => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    const activityQ = query(collection(db, "activity"), orderBy("createdAt", "desc"), limit(10));
    unsubs.push(onSnapshot(activityQ, (snap) => {
      setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(
      onSnapshot(collection(db, "scheduleOverrides"), (snap) => {
        const overrides = {};
        snap.docs.forEach(d => { overrides[d.id] = d.data(); });
        setSchedule(() => {
          const merged = {};
          DAYS.forEach(day => {
            merged[day] = (INITIAL_SCHEDULE[day] || []).map(item => {
              if (overrides[item.id]) return { ...item, ...overrides[item.id] };
              return item;
            });
          });
          return merged;
        });
        setLoading(false);
      })
    );

    return () => unsubs.forEach(u => u()); //task on manager and managing
  }, []);

  // ── Sync pulse helper ──
  const pulse = () => {
    setSyncPulse(true);
    setTimeout(() => setSyncPulse(false), 2000);
  };

  // ── Activity logger ──
  const logActivity = async (action, userId) => {
    const uid = userId || activeUser;
    const user = USERS.find(u => u.id === uid);
    await addDoc(collection(db, "activity"), {
      user: user?.name || "Unknown",
      action,
      color: getUserColorKey(uid),
      createdAt: serverTimestamp(),
    });
  };

  // ── Schedule handlers ──
  const handleChangeSchedule = (item, day) => setChangeModal({ item, day });

  const handleSaveSchedule = async (updated) => {
    const { item } = changeModal;
    try {
      await setDoc(doc(db, "scheduleOverrides", item.id), {
        ...updated,
        courseId: item.id,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await logActivity(
        `mengubah jadwal '${item.course}' ke ${updated.mode}${updated.cancelled ? " (DIBATALKAN)" : ""}`,
        activeUser
      );
      pulse();
    } catch (err) {
      console.error("Error saving schedule override:", err);
    }
    setChangeModal(null);
  };

  // ── Task handlers ──
  const handleAddTask = async (taskData) => {
    try {
      await addDoc(collection(db, "tasks"), {
        ...taskData,
        deadline: taskData.deadline instanceof Date ? taskData.deadline : new Date(taskData.deadline),
        createdAt: serverTimestamp(),
      });
      await logActivity(`menambahkan tugas baru '${taskData.title}'`);
      pulse();
      setAddTaskModal(false);
    } catch (err) {
      console.error("Error adding task:", err);
    }
  };

  const handleMoveTask = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, "tasks", id), { status: newStatus, updatedAt: serverTimestamp() });
      const task = tasks.find(t => t.id === id);
      if (newStatus === "Completed" && task) {
        await logActivity(`menyelesaikan task '${task.title}'`);
      }
      pulse();
    } catch (err) {
      console.error("Error moving task:", err);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      const task = tasks.find(t => t.id === id);
      await deleteDoc(doc(db, "tasks", id));
      if (task) await logActivity(`menghapus tugas '${task.title}'`);
      pulse();
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  // ── Note handlers ──
  const handleAddNote = async (noteData) => {
    try {
      await addDoc(collection(db, "notes"), {
        ...noteData,
        createdAt: serverTimestamp(),
      });
      await logActivity(`menambahkan catatan '${noteData.title}'`);
      pulse();
      setAddNoteModal(false);
    } catch (err) {
      console.error("Error adding note:", err);
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      const note = notes.find(n => n.id === id);
      await deleteDoc(doc(db, "notes", id));
      if (note) await logActivity(`menghapus catatan '${note.title}'`);
      pulse();
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  // ── Link handlers ──
  const handleAddLink = async (linkData) => {
    try {
      await addDoc(collection(db, "links"), {
        ...linkData,
        createdAt: serverTimestamp(),
      });
      await logActivity(`menambahkan quick link '${linkData.label}'`);
      pulse();
    } catch (err) {
      console.error("Error adding link:", err);
    }
  };

  const handleDeleteLink = async (id) => {
    try {
      const link = links.find(l => l.id === id);
      await deleteDoc(doc(db, "links", id));
      if (link) await logActivity(`menghapus quick link '${link.label}'`);
      pulse();
    } catch (err) {
      console.error("Error deleting link:", err);
    }
  };

  // ── Derived values ──
  const navItems = [
    { key: "schedule", icon: "📅", label: "Jadwal Kuliah" },
    { key: "tasks", icon: "📋", label: "Tugas & Deadline" },
    { key: "notes", icon: "📝", label: "Notulensi" },
    { key: "links", icon: "🔗", label: "Quick Links" },
  ];

  const currentUser = USERS.find(u => u.id === activeUser);
  const pendingTasks = tasks.filter(t => t.status !== "Completed").length;

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans" style={{fontFamily: "'DM Sans', 'Nunito', system-ui, sans-serif"}}>
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-40 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-lg">🎓</div>
            <div>
              <p className="font-black text-slate-800 text-base leading-none">Academic</p>
              <p className="font-black text-indigo-600 text-base leading-none">Hub</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 mt-3 px-2 py-1.5 rounded-lg ${syncPulse ? "bg-emerald-100" : "bg-slate-50"} transition-colors duration-500`}>
            <div className={`w-2 h-2 rounded-full ${syncPulse ? "bg-emerald-400 animate-ping" : "bg-emerald-400"}`} />
            <span className="text-xs text-emerald-700 font-semibold">Real-time Sync Aktif</span>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Login Sebagai</p>
          <div className="space-y-1">
            {USERS.map(u => (
              <button key={u.id} onClick={() => setActiveUser(u.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeUser === u.id ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50"}`}>
                <Avatar user={u.id} size="md" />
                <div className="text-left">
                  <p className={`text-sm font-semibold ${activeUser === u.id ? "text-indigo-700" : "text-slate-700"}`}>{u.name}</p>
                  <p className="text-[10px] text-slate-400">Admin</p>
                </div>
                {activeUser === u.id && <span className="ml-auto text-indigo-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Menu</p>
          {navItems.map(item => (
            <button key={item.key} onClick={() => { setActiveSection(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${activeSection === item.key ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-slate-50"}`}>
              <span className="text-base">{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
              {item.key === "tasks" && pendingTasks > 0 && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeSection === item.key ? "bg-white text-indigo-700" : "bg-red-100 text-red-600"}`}>{pendingTasks}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-slate-50 rounded-xl">
              <p className="text-lg font-black text-indigo-600">{Object.values(schedule).flat().length}</p>
              <p className="text-[10px] text-slate-500">Kelas</p>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded-xl">
              <p className="text-lg font-black text-amber-600">{pendingTasks}</p>
              <p className="text-[10px] text-slate-500">Tugas</p>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded-xl">
              <p className="text-lg font-black text-emerald-600">{notes.length}</p>
              <p className="text-[10px] text-slate-500">Catatan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">☰</button>
          <div className="flex-1">
            <h1 className="font-black text-slate-800 text-lg leading-none">
              {navItems.find(n => n.key === activeSection)?.label}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full ${syncPulse ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"} text-xs font-semibold transition-colors duration-500`}>
              <div className={`w-1.5 h-1.5 rounded-full ${syncPulse ? "bg-emerald-400 animate-pulse" : "bg-emerald-400"}`} />
              {syncPulse ? "Menyimpan..." : "Tersinkron"}
            </div>
            <Avatar user={activeUser} size="md" />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-800">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-400">Admin</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 space-y-6">

          {/* ── SCHEDULE SECTION ── */}
          {activeSection === "schedule" && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Total Kelas/Minggu", value: Object.values(schedule).flat().length, icon: "📚", color: "from-indigo-500 to-indigo-600" },
                  { label: "Kelas Online", value: Object.values(schedule).flat().filter(c => c.mode === "ONLINE").length, icon: "💻", color: "from-emerald-500 to-emerald-600" },
                  { label: "Jadwal Berubah", value: Object.values(schedule).flat().filter(c => c.changed).length, icon: "⚡", color: "from-amber-500 to-amber-600" },
                  { label: "Total SKS/Minggu", value: Object.values(schedule).flat().reduce((a, c) => a + c.sks, 0), icon: "🎯", color: "from-violet-500 to-violet-600" },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-lg flex-shrink-0`}>{s.icon}</div>
                    <div>
                      <p className="text-2xl font-black text-slate-800">{s.value}</p>
                      <p className="text-xs text-slate-500 leading-tight">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-5">
                <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1">
                  <button onClick={() => setScheduleView("weekly")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${scheduleView === "weekly" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
                    📅 Mingguan
                  </button>
                  <button onClick={() => setScheduleView("today")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${scheduleView === "today" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
                    ☀️ Hari Ini
                  </button>
                </div>
              </div>

              {scheduleView === "weekly"
                ? <WeeklyCalendar schedule={schedule} onChangeSchedule={handleChangeSchedule} />
                : <TodayAgenda schedule={schedule} onChangeSchedule={handleChangeSchedule} />
              }
            </div>
          )}

          {/* ── TASKS SECTION ── */}
          {activeSection === "tasks" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "To-Do", count: tasks.filter(t => t.status === "Todo").length, color: "text-slate-700 bg-slate-100" },
                      { label: "In Progress", count: tasks.filter(t => t.status === "InProgress").length, color: "text-amber-700 bg-amber-100" },
                      { label: "Selesai", count: tasks.filter(t => t.status === "Completed").length, color: "text-emerald-700 bg-emerald-100" },
                    ].map(s => (
                      <div key={s.label} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${s.color}`}>{s.count} {s.label}</div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setAddTaskModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                  + Tambah Tugas
                </button>
              </div>
              <TaskBoard tasks={tasks} onMove={handleMoveTask} onDelete={handleDeleteTask} />
            </div>
          )}

          {/* ── NOTES SECTION ── */}
          {activeSection === "notes" && (
            <NotesSection
              notes={notes}
              onDelete={handleDeleteNote}
              onAddNote={() => setAddNoteModal(true)}
            />
          )}

          {/* ── LINKS SECTION ── */}
          {activeSection === "links" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <QuickLinks links={links} onAdd={handleAddLink} onDelete={handleDeleteLink} />
              </div>
              <div>
                <ActivityLog log={activity} />
              </div>
            </div>
          )}

          {activeSection !== "links" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <QuickLinks links={links} onAdd={handleAddLink} onDelete={handleDeleteLink} />
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <ActivityLog log={activity} />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── FAB for tasks (moved up to not clash with chatbot) ── */}
      {activeSection === "tasks" && (
        <button onClick={() => setAddTaskModal(true)}
          className="fixed bottom-24 left-6 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-300 flex items-center justify-center text-2xl hover:bg-indigo-700 transition-all hover:scale-110 z-20">
          +
        </button>
      )}

      {/* ── MODALS ── */}
      {changeModal && (
        <ChangeScheduleModal
          item={changeModal.item}
          day={changeModal.day}
          onSave={handleSaveSchedule}
          onClose={() => setChangeModal(null)}
        />
      )}
      {addTaskModal && (
        <AddTaskModal onSave={handleAddTask} onClose={() => setAddTaskModal(false)} />
      )}
      {addNoteModal && (
        <AddNoteModal onSave={handleAddNote} onClose={() => setAddNoteModal(false)} activeUser={activeUser} />
      )}

      {/* ── AI CHATBOT ── */}
      <Chatbot
        schedule={schedule}
        tasks={tasks}
        notes={notes}
        links={links}
        activeUser={activeUser}
      />
    </div>
  );
}
