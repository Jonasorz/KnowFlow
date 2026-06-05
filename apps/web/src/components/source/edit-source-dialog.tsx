import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUpdateSource, useDeleteSource } from '@/hooks/use-sources';
import { Upload, X, Camera, MessageCircle, Trash2 } from 'lucide-react';
import type { SourceInfo } from '@knowflow/shared';

interface EditSourceDialogProps {
  source: SourceInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSourceDialog({ source, open, onOpenChange }: EditSourceDialogProps) {
  const [name, setName] = useState(source.name);
  const [description, setDescription] = useState(source.description || '');
  const [avatarUrl, setAvatarUrl] = useState(source.avatarUrl || '');
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateSource = useUpdateSource();
  const deleteSource = useDeleteSource();

  // Reset form values when dialog opens or source changes
  useEffect(() => {
    setName(source.name);
    setDescription(source.description || '');
    setAvatarUrl(source.avatarUrl || '');
    setError('');
  }, [source, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (e.g. limit to 300KB for DB storage efficiency)
      if (file.size > 300 * 1024) {
        setError('头像图片不能超过 300KB，以保证本地数据库存储效率。');
        return;
      }

      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('订阅源名称不能为空。');
      return;
    }

    try {
      await updateSource.mutateAsync({
        id: source.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新订阅源失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑订阅源</DialogTitle>
          <DialogDescription>
            修改该订阅源的名称、描述和头像图片。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Avatar Edit Section */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div 
              className="group relative h-20 w-20 cursor-pointer overflow-hidden rounded-full border border-border shadow-inner" 
              onClick={handleUploadClick}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                  <MessageCircle className="h-8 w-8 text-muted-foreground/60" />
                </div>
              )}
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleUploadClick}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                上传本地图片
              </Button>
              {avatarUrl && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive" 
                  onClick={handleRemoveAvatar}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  删除头像
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">订阅源名称 *</label>
            <Input
              placeholder="例如: 腾讯科技"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">网络头像链接 (可选)</label>
            <Input
              placeholder="也可在此直接粘贴网络图片 URL 地址"
              value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">描述 (可选)</label>
            <textarea
              placeholder="关于该订阅源的简要介绍"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[60px] text-xs p-3 rounded-lg border border-border bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-destructive mt-1">{error}</p>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-border mt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (confirm(`确定要删除订阅源 "${source.name}" 吗？这将会删除该源下的所有文章和分析。`)) {
                  deleteSource.mutate(source.id, {
                    onSuccess: () => onOpenChange(false)
                  });
                }
              }}
              disabled={deleteSource.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除订阅源
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={updateSource.isPending || deleteSource.isPending}>
                {updateSource.isPending ? '保存中...' : '保存修改'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
