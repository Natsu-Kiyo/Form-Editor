'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';

import { createChannelAction } from '../actions/create-channel';

/**
 * 新建渠道。
 *
 * 「链接参数」可选：留空由服务端按渠道名推一个（中文名推不出拉丁串，会落成 `ch-xxxxxx`）。
 * 做成可填是因为**参数会出现在对外链接里**，有人就是想让它是 `?src=douyin` 这种一眼认得的。
 */
export function NewChannelForm({ questionnaireId }: { questionnaireId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [srcToken, setSrcToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await createChannelAction(questionnaireId, { name, srcToken });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      // 成功后清空并关窗：渠道名留在输入框里，下一次新建很容易把同一个名字再提交一遍
      setName('');
      setSrcToken('');
      setOpen(false);
    });
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        新建渠道
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title="新建渠道" description="用于区分答卷是从哪里来的" width="sm">
          <div className="space-y-3.5">
            <div>
              <Label htmlFor="channel-name">渠道名称</Label>
              <Input
                id="channel-name"
                value={name}
                placeholder="例如：微信公众号"
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="channel-src">链接参数（可选）</Label>
              <Input
                id="channel-src"
                value={srcToken}
                placeholder="留空自动生成，例如 wechat"
                onChange={(event) => setSrcToken(event.target.value)}
              />
              <p className="text-ink-400 mt-1.5 text-[11.5px] leading-5">
                会拼进链接：<code className="text-ink-500 font-mono">?src={srcToken || '…'}</code>
                。只能用字母、数字、连字符与下划线。
              </p>
            </div>

            {message ? (
              <p role="alert" className="text-[12px] text-rose-600">
                {message}
              </p>
            ) : null}

            <div className="flex gap-2.5 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" disabled={pending || name.trim() === ''} onClick={submit}>
                {pending ? '创建中…' : '创建'}
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
