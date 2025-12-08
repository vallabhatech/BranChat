import { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Settings, 
  Mail, 
  Key, 
  Trash2, 
  LogOut, 
  ChevronDown,
  Edit3,
  Shield,
  Bell,
  Moon,
  Sun,
  Globe
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface UserSettingsDropdownProps {
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
  onOpenSecurity?: () => void;
  onDeleteAccount?: () => void;
}

export function UserSettingsDropdown({
  onOpenSettings,
  onOpenProfile,
  onOpenSecurity,
  onDeleteAccount
}: UserSettingsDropdownProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuItemClick = async (action: () => void | Promise<void>) => {
    try {
      await action();
    } catch (error) {
      console.error('Error executing menu action:', error);
    } finally {
      setIsOpen(false);
    }
  };

  const isGuest = user?.isGuest || user?.email?.startsWith('guest@');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="User menu"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <User size={16} className="text-gray-600 dark:text-gray-300" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {user?.name || (isGuest ? 'Guest User' : 'User')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {isGuest ? 'Guest Session' : (user?.email || 'No email')}
            </div>
          </div>
          <ChevronDown 
            size={16} 
            className={`text-gray-500 dark:text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <User size={20} className="text-gray-600 dark:text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.name || (isGuest ? 'Guest User' : 'User')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {isGuest ? 'Temporary session' : (user?.email || 'No email set')}
                </div>
                {isGuest && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Sign up to save your conversations
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Profile Settings - Only for registered users */}
            {!isGuest && (
              <>
                <button
                  onClick={() => handleMenuItemClick(() => onOpenProfile?.())}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Edit3 size={16} />
                  <div className="text-left">
                    <div>Edit Profile</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Name, avatar, preferences</div>
                  </div>
                </button>

                <button
                  onClick={() => handleMenuItemClick(() => onOpenSecurity?.())}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Shield size={16} />
                  <div className="text-left">
                    <div>Security</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Password, 2FA, sessions</div>
                  </div>
                </button>

                <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              </>
            )}

            {/* General Settings */}
            <button
              onClick={() => handleMenuItemClick(() => onOpenSettings?.())}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings size={16} />
              <div className="text-left">
                <div>Settings</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">App preferences, data</div>
              </div>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => handleMenuItemClick(toggleTheme)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <div className="text-left">
                <div>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Switch theme</div>
              </div>
            </button>

            {/* Notifications - Only for registered users */}
            {!isGuest && (
              <button
                onClick={() => handleMenuItemClick(() => console.log('Notifications settings'))}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Bell size={16} />
                <div className="text-left">
                  <div>Notifications</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Email, push notifications</div>
                </div>
              </button>
            )}

            {/* Language */}
            <button
              onClick={() => handleMenuItemClick(() => console.log('Language settings'))}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Globe size={16} />
              <div className="text-left">
                <div>Language</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">English (US)</div>
              </div>
            </button>

            <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

            {/* Danger Zone - Only for registered users */}
            {!isGuest && (
              <button
                onClick={() => handleMenuItemClick(() => onDeleteAccount?.())}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={16} />
                <div className="text-left">
                  <div>Delete Account</div>
                  <div className="text-xs text-red-500 dark:text-red-400">Permanently delete your account</div>
                </div>
              </button>
            )}

            {/* Logout */}
            <button
              onClick={() => handleMenuItemClick(signOut)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut size={16} />
              <div className="text-left">
                <div>{isGuest ? 'End Session' : 'Sign Out'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isGuest ? 'Clear session data' : 'Sign out of your account'}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}