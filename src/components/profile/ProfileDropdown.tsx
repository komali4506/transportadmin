import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, LogOut, ShieldAlert, Mail } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  adminProfile: {
    fullName: string;
    email: string;
    role: string;
    profilePhoto: string;
    isOnline: boolean;
  };
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  isOpen,
  onClose,
  onEditProfile,
  onLogout,
  adminProfile
}) => {
  const navigate = useNavigate();

  const handleOptionClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Transparent Backdrop to close dropdown on outside click */}
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-72 rounded-xl bg-white border border-gray-100 shadow-2xl z-50 overflow-hidden divide-y divide-gray-50 font-sans"
            style={{ top: '100%' }}
          >
            {/* Header info */}
            <div className="p-4 bg-gradient-to-br from-emerald-50/50 to-white flex items-center gap-3">
              <ProfileAvatar 
                src={adminProfile.profilePhoto} 
                name={adminProfile.fullName} 
                size="md" 
                showStatus={true}
                isOnline={adminProfile.isOnline}
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate">{adminProfile.fullName}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    {adminProfile.role}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 truncate mt-1 flex items-center gap-1">
                  <Mail size={10} />
                  {adminProfile.email}
                </p>
              </div>
            </div>

            {/* Menu options */}
            <div className="p-1.5 space-y-0.5">
              <button
                onClick={() => handleOptionClick(() => navigate('/settings'))}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50/55 hover:text-emerald-800 rounded-lg transition-all group text-left"
              >
                <div className="p-1.5 rounded-md bg-gray-50 group-hover:bg-emerald-100/50 group-hover:text-emerald-700 transition-colors">
                  <User size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-medium leading-none">View Profile</p>
                  <p className="text-[10px] text-gray-400 mt-1">Review account profile details</p>
                </div>
              </button>
            </div>

            {/* Logout Action */}
            <div className="p-1.5">
              <button
                onClick={() => handleOptionClick(onLogout)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-all group text-left"
              >
                <div className="p-1.5 rounded-md bg-red-50 text-red-600 group-hover:bg-red-100 transition-colors">
                  <LogOut size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold leading-none">Logout</p>
                  <p className="text-[10px] text-red-400 mt-1">Securely end administrative session</p>
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileDropdown;
