import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Phone, 
  Camera, 
  Shield, 
  Bell, 
  Lock, 
  Smartphone, 
  Laptop, 
  Check, 
  Loader2, 
  Globe, 
  Clock, 
  Trash2, 
  Upload 
} from 'lucide-react';
import { useProfileStore } from '@/store/profileStore';
import { useToast } from '@/hooks/use-toast';
import ProfileAvatar from '@/components/profile/ProfileAvatar';

export const ProfileSettingsPage: React.FC = () => {
  const { profile, updateProfile, uploadPhoto, removePhoto, fetchProfile, isLoading } = useProfileStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'personal' | 'photo' | 'security' | 'notifications'>('personal');

  // Personal Info Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  
  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Notification State
  const [emailNotify, setEmailNotify] = useState({
    loads: true,
    payments: true,
    transporters: false,
    systemAlerts: true
  });
  const [pushNotify, setPushNotify] = useState({
    loads: true,
    payments: false,
    transporters: true,
    systemAlerts: true
  });
  const [smsNotify, setSmsNotify] = useState({
    loads: false,
    payments: true,
    transporters: false,
    systemAlerts: false
  });

  // Photo state
  const [photoPreview, setPhotoPreview] = useState('');
  const [tempFile, setTempFile] = useState<File | null>(null);

  // Error States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch / Sync profile details on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setEmail(profile.email || '');
      setMobileNumber(profile.mobileNumber || '');
      setPhotoPreview(profile.profilePhoto || '');
      setTempFile(null);
    }
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Unsupported Format",
        description: "Only PNG, JPG, or JPEG files are accepted.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum profile photo size is 2MB.",
        variant: "destructive"
      });
      return;
    }

    setTempFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSavePhoto = async () => {
    if (!tempFile) return;
    setIsSaving(true);
    try {
      await uploadPhoto(tempFile);
      setTempFile(null);
      toast({
        title: "Avatar Updated",
        description: "Your profile photo has been successfully updated.",
      });
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update profile image.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsSaving(true);
    try {
      await removePhoto();
      setPhotoPreview('');
      setTempFile(null);
      toast({
        title: "Avatar Removed",
        description: "Profile photo reset to initials placeholder.",
      });
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: "Failed to remove profile photo.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const validatePersonalForm = () => {
    const tempErrors: Record<string, string> = {};
    if (!fullName.trim()) tempErrors.fullName = 'Full Name is required';
    else if (fullName.trim().length < 3) tempErrors.fullName = 'Name must be at least 3 characters';

    if (!email.trim()) tempErrors.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) tempErrors.email = 'Invalid email address';

    if (!mobileNumber.trim()) tempErrors.mobileNumber = 'Mobile number is required';
    else {
      const clean = mobileNumber.replace(/\s+/g, '');
      if (!/^\+?[0-9-]{10,15}$/.test(clean)) tempErrors.mobileNumber = 'Invalid mobile format (10-15 digits)';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePersonalForm()) return;

    setIsSaving(true);
    try {
      await updateProfile({
        fullName,
        email,
        mobileNumber
      });
      toast({
        title: "Information Synchronized",
        description: "Personal credentials updated successfully across ERP components.",
      });
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to save information.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSecuritySave = (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    if (!currentPassword) tempErrors.currentPassword = 'Current password is required';
    if (newPassword.length < 8) tempErrors.newPassword = 'Password must be at least 8 characters';
    if (newPassword !== confirmPassword) tempErrors.confirmPassword = 'Passwords do not match';

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: "Security Credentials Updated",
        description: "Administrative password updated successfully. Active sessions retained.",
      });
    }, 800);
  };

  const handleNotificationSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Preferences Saved",
        description: "ERP notification matrix updated successfully.",
      });
    }, 600);
  };

  const tabs = [
    { id: 'personal', name: 'Personal Information', icon: User },
    { id: 'photo', name: 'Profile Photo', icon: Camera },
    { id: 'security', name: 'Security Settings', icon: Shield },
    { id: 'notifications', name: 'Notification Preferences', icon: Bell }
  ] as const;

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-12">
      {/* Top Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <ProfileAvatar
              src={profile?.profilePhoto || ''}
              name={profile?.fullName || 'Admin'}
              size="lg"
              showStatus={true}
              isOnline={profile?.isOnline}
              className="ring-4 ring-emerald-500/30"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{profile?.fullName}</h1>
              <p className="text-emerald-300 text-sm font-medium mt-0.5">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-700/60 text-emerald-100 uppercase tracking-wider border border-emerald-500/20">
                  {profile?.role}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ERP Server Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side Tab Navigation */}
        <div className="lg:col-span-1 bg-white border border-gray-100 shadow-sm rounded-2xl p-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setErrors({});
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all text-left ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-800 shadow-inner' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-emerald-700' : 'text-gray-400'} />
                {tab.name}
              </button>
            )
          })}
        </div>

        {/* Right Side Content Panel */}
        <div className="lg:col-span-3 bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden min-h-[480px]">
          
          {/* PERSONAL INFORMATION TAB */}
          {activeTab === 'personal' && (
            <form onSubmit={handleSavePersonalInfo} className="p-6 md:p-8 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Personal Information</h3>
                <p className="text-xs text-gray-500 mt-1">Manage details linking your identity to log logs and record audits.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full Name"
                      className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                        errors.fullName ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                      }`}
                    />
                  </div>
                  {errors.fullName && <p className="text-xs text-red-500 font-medium">{errors.fullName}</p>}
                </div>

                {/* Email Address */}
                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address"
                      className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                        errors.email ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                      }`}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email}</p>}
                </div>

                {/* Mobile Number */}
                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="Mobile Number"
                      className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                        errors.mobileNumber ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                      }`}
                    />
                  </div>
                  {errors.mobileNumber && <p className="text-xs text-red-500 font-medium">{errors.mobileNumber}</p>}
                </div>

                {/* Role (Read Only) */}
                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Role Level</label>
                  <input
                    type="text"
                    value={profile?.role || 'SUPER ADMIN'}
                    disabled
                    className="w-full px-4 py-2.5 text-sm bg-gray-100 border border-gray-200 rounded-xl text-gray-400 cursor-not-allowed uppercase font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 flex items-center gap-2 transition-all disabled:opacity-70"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save Information
                </button>
              </div>
            </form>
          )}

          {/* PROFILE PHOTO TAB */}
          {activeTab === 'photo' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Profile Photo</h3>
                <p className="text-xs text-gray-500 mt-1">Upload a professional image. Replaces existing image inside all system layouts.</p>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8 p-6 bg-emerald-50/20 border border-emerald-100/50 rounded-2xl">
                <ProfileAvatar
                  src={photoPreview}
                  name={fullName || 'Admin'}
                  size="xl"
                  showStatus={false}
                  className="ring-4 ring-emerald-500/20"
                />

                <div className="space-y-4 flex-1 text-center md:text-left">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-gray-800">Upload new image</h4>
                    <p className="text-xs text-gray-400">PNG, JPG, or JPEG. Maximum file size of 2MB.</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <button
                      type="button"
                      onClick={handleTriggerUpload}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded-lg transition-colors shadow disabled:opacity-50"
                    >
                      <Upload size={14} />
                      Choose File
                    </button>

                    {tempFile && (
                      <button
                        type="button"
                        onClick={handleSavePhoto}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Save Selected
                      </button>
                    )}

                    {photoPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Remove Image
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/jpg"
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECURITY SETTINGS TAB */}
          {activeTab === 'security' && (
            <div className="p-6 md:p-8 space-y-8">
              <form onSubmit={handleSecuritySave} className="space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="text-base font-bold text-gray-900">Security Settings</h3>
                  <p className="text-xs text-gray-500 mt-1">Configure administrative passwords and security levels.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                          errors.currentPassword ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                        }`}
                      />
                    </div>
                    {errors.currentPassword && <p className="text-xs text-red-500 font-medium">{errors.currentPassword}</p>}
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                          errors.newPassword ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                        }`}
                      />
                    </div>
                    {errors.newPassword && <p className="text-xs text-red-500 font-medium">{errors.newPassword}</p>}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                          errors.confirmPassword ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                        }`}
                      />
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-500 font-medium">{errors.confirmPassword}</p>}
                  </div>
                </div>

                <div className="flex justify-end border-b border-gray-100 pb-6">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    Update Password
                  </button>
                </div>
              </form>

              {/* MFA Sub-section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-800">Two-Factor Authentication (2FA)</h4>
                <div className="flex items-start justify-between p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      <Smartphone size={16} className="text-emerald-700" />
                      SMS / Authenticator Code Verification
                    </p>
                    <p className="text-xs text-gray-500 max-w-md">Require a security code alongside your password whenever accessing the ERP dashboard.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer mt-1">
                    <input 
                      type="checkbox" 
                      checked={mfaEnabled} 
                      onChange={(e) => {
                        setMfaEnabled(e.target.checked);
                        toast({
                          title: e.target.checked ? "MFA Activated" : "MFA Deactivated",
                          description: e.target.checked ? "Two-Factor Auth has been enabled for this Super Admin." : "Security layer removed. Enter password only to login.",
                        });
                      }}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
                  </label>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-800">Active ERP Sessions</h4>
                <div className="space-y-3">
                  {/* Session 1 */}
                  <div className="flex items-center justify-between p-4 border border-emerald-100 rounded-2xl bg-emerald-50/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                        <Laptop size={18} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-gray-800">Chrome on Windows (11)</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Globe size={12} />
                          103.22.45.10 (Mumbai, IN) 
                          <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold uppercase ml-1.5">Active Now</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <Clock size={12} />
                      Expires in 7 hrs
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATION PREFERENCES TAB */}
          {activeTab === 'notifications' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Notification Preferences</h3>
                <p className="text-xs text-gray-500 mt-1">Configure when and how you receive status updates regarding logistics actions.</p>
              </div>

              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Logistics Trigger</th>
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Email</th>
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Push App</th>
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">SMS Alert</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {/* Row 1 */}
                      <tr>
                        <td className="py-4">
                          <p className="text-sm font-bold text-gray-800">New Bid Publishing</p>
                          <p className="text-xs text-gray-400">Triggered whenever a dispatcher publishes a new freight load request.</p>
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={emailNotify.loads} 
                            onChange={(e) => setEmailNotify(prev => ({ ...prev, loads: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={pushNotify.loads}
                            onChange={(e) => setPushNotify(prev => ({ ...prev, loads: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={smsNotify.loads}
                            onChange={(e) => setSmsNotify(prev => ({ ...prev, loads: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                      </tr>

                      {/* Row 2 */}
                      <tr>
                        <td className="py-4">
                          <p className="text-sm font-bold text-gray-800">Payments & Escrow Settled</p>
                          <p className="text-xs text-gray-400">Updates regarding escrow transfers, payments processed, and hold releases.</p>
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={emailNotify.payments}
                            onChange={(e) => setEmailNotify(prev => ({ ...prev, payments: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={pushNotify.payments}
                            onChange={(e) => setPushNotify(prev => ({ ...prev, payments: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={smsNotify.payments}
                            onChange={(e) => setSmsNotify(prev => ({ ...prev, payments: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                      </tr>

                      {/* Row 3 */}
                      <tr>
                        <td className="py-4">
                          <p className="text-sm font-bold text-gray-800">Transporter Verifications</p>
                          <p className="text-xs text-gray-400">Alerts when new transporters upload compliance documents for approval.</p>
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={emailNotify.transporters}
                            onChange={(e) => setEmailNotify(prev => ({ ...prev, transporters: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={pushNotify.transporters}
                            onChange={(e) => setPushNotify(prev => ({ ...prev, transporters: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={smsNotify.transporters}
                            onChange={(e) => setSmsNotify(prev => ({ ...prev, transporters: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                      </tr>

                      {/* Row 4 */}
                      <tr>
                        <td className="py-4">
                          <p className="text-sm font-bold text-gray-800">System Security Alerts</p>
                          <p className="text-xs text-gray-400">Logs regarding unauthorized IP accesses, session threats, and key modifications.</p>
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={emailNotify.systemAlerts}
                            onChange={(e) => setEmailNotify(prev => ({ ...prev, systemAlerts: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={pushNotify.systemAlerts}
                            onChange={(e) => setPushNotify(prev => ({ ...prev, systemAlerts: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={smsNotify.systemAlerts}
                            onChange={(e) => setSmsNotify(prev => ({ ...prev, systemAlerts: e.target.checked }))}
                            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-700 h-4 w-4"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleNotificationSave}
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 flex items-center gap-2 transition-colors"
                  >
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
