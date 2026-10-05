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
  /** 失败回填用。见 form-state.ts 里对「React 19 会重置表单」的说明 */
  defaultValue?: string;
  invalid?: boolean;
  required?: boolean;
};

/**
 * 密码输入框：右侧带「显示 / 隐藏」切换。登录、注册两处共用。
 *
 * 做成密码框自带切换而不是每个表单各写一遍 —— 否则两处的图标、位置、
 * aria 文案必然漂移（设计稿 W01 的密码框就带这个眼睛按钮）。
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  placeholder,
  defaultValue,
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
          defaultValue={defaultValue}
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
