import React, { useState } from 'react';
import { updateSheetData } from '../services/googleSheets';
import toast from 'react-hot-toast';
import { Plus, X, Trash2, Edit2 } from 'lucide-react';
import { cn } from '../utils/cn';

// No colors needed, keeping it monochrome

export const NotesManager = ({ notesData = [], onDataChanged }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: '', title: '', content: '', 'Src Row': '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openModal = (note = null) => {
    if (note) {
      setFormData({ ...note });
    } else {
      setFormData({ id: '', title: '', content: '', 'Src Row': '' });
    }
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title && !formData.content) return toast.error('Note cannot be empty');
    
    setIsSubmitting(true);
    const lt = toast.loading('Saving note...');
    try {
      const payload = { ...formData, date: new Date().toISOString() };
      const action = formData.id ? 'edit' : 'add';
      if (!formData.id) payload.id = Date.now().toString();

      const r = await updateSheetData(action, 'Notes', payload);
      if (r.status === 'error') throw new Error(r.message);
      
      toast.success(action === 'add' ? 'Note added!' : 'Note updated!', { id: lt });
      setIsEditing(false);
      onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const lt = toast.loading('Deleting note...');
    try {
      const r = await updateSheetData('delete', 'Notes', { id: deleteTarget.id, 'Src Row': deleteTarget['Src Row'] });
      if (r.status === 'error') throw new Error(r.message);
      
      toast.success('Note deleted!', { id: lt });
      setDeleteTarget(null);
      onDataChanged?.();
    } catch (err) {
      toast.error('Error: ' + err.message, { id: lt });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Sticky Notes</h2>
          <p className="text-sm text-gray-400 mt-1">Jot down quick thoughts and important reminders.</p>
        </div>
        <button onClick={() => openModal()} className="premium-button text-sm flex-shrink-0">
          <Plus size={14} strokeWidth={2.5} /> <span className="hidden sm:inline">New Note</span>
        </button>
      </div>

      {notesData.length === 0 ? (
        <div className="premium-card py-20 text-center">
          <p className="text-gray-400 text-sm font-medium">
            Your board is empty.{' '}
            <button onClick={() => openModal()} className="text-gray-900 font-bold underline underline-offset-2">
              Add a sticky note
            </button>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
          {notesData.map((note, i) => (
            <div key={i} className="relative p-5 rounded-2xl shadow-sm border border-gray-100 bg-gray-50 transition-transform hover:-translate-y-1 group">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-gray-900 pr-8 leading-tight">{note.title}</h3>
                
                {/* Hover Actions */}
                <div className="absolute top-3 right-3 flex gap-1">
                  <button onClick={() => openModal(note)} className="p-1.5 bg-white/60 hover:bg-white rounded-lg text-gray-600 transition-colors shadow-sm">
                    <Edit2 size={13} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => setDeleteTarget(note)} className="p-1.5 bg-white/60 hover:bg-white rounded-lg text-gray-600 transition-colors shadow-sm">
                    <Trash2 size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
              
              {note.date && (
                <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mt-4">
                  {new Date(note.date).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isEditing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div className="modal-sheet">
            <div className="modal-handle"><div className="modal-handle-bar" /></div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">{formData.id ? 'Edit Note' : 'New Sticky Note'}</h3>
              <button onClick={() => setIsEditing(false)} className="icon-btn text-gray-400 hover:text-gray-900">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Title</label>
                <input type="text" className="premium-input" placeholder="Note Title (Optional)" 
                  value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">Content <span className="text-gray-400">*</span></label>
                <textarea required rows={5} className="premium-input resize-none" placeholder="Write your thoughts here..." 
                  value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
              </div>
              {/* Color tag removed as requested */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="ghost-button flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="premium-button flex-1">
                  {isSubmitting ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-slide-up">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                <Trash2 size={26} className="text-gray-900" strokeWidth={2} />
              </div>
            </div>
            <h3 className="text-[17px] font-black text-center text-gray-900 mb-1">Delete Note?</h3>
            <p className="text-sm text-center text-gray-500 mb-6 px-4">Are you sure you want to delete this note? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="ghost-button flex-1 justify-center">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} 
                className="flex-1 py-2.5 text-sm font-bold bg-gray-900 hover:bg-black text-white rounded-xl transition-colors min-h-[42px] disabled:opacity-60">
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
