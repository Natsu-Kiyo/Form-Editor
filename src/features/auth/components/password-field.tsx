'use client';

import { useId, useState } from 'react';

import { EyeIcon, EyeOffIcon } from '@/components/icons/ui-icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type PasswordFieldProps = {
  name: string;
  label: string;
  autoComplete?: 'current-password' | 'new-password';
  placeholder?: string;
  invalid?: boolean;
  required?: boolean;
};

/**
 * 密码输入框：右侧带「显示 / 隐藏」切换。登录、注册两处共用。
 *
 * 做成密码框自带切换而不是每个表单各写一遍 —— 否则两处的图标、位置、
 * aria 文案必然漂移（设计稿 W01 的密码框就带这个眼睛按钮）。
 *
 * **刻意没有 `defaultValue`**：失败时不回填口令（`values` 会进 action 的响应体与
 * input 的 value 里，而浏览器本来就不会清空口令框 —— 理由见 `login.ts`）。
 * 把这条规矩做成「没有这个 prop」比写在注释里更靠得住：想回填就得先加回这个口子。
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  placeholder,
  invalid = false,
  required = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>

      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          invalid={invalid}
          required={required}
          className="h-11 pr-11"
        />

        <button
          type="button"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? '隐藏密码' : '显示密码'}
          aria-pressed={visible}
          className="text-ink-400 hover:text-ink-600 absolute top-1/2 right-3 -translate-y-1/2 transition-colors duration-150"
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
    </div>
  );
}
