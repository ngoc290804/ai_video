use crate::{
    domain::{n, s},
    error::{invalid, Error, Result},
    storage,
};
use serde_json::Value;
use std::{
    fs,
    path::{Component, Path},
};
/// Restore the exact registered bytes. Registry identity and all revision/timeline
/// references remain valid; a different file must be imported as a new asset.
pub fn restore(dir: &Path, asset: &Value, source: &Path) -> Result<()> {
    if fs::metadata(source)?.len() != n(asset, "bytes") {
        return Err(Error::new(
            "ASSET_CHANGED",
            "File được chọn không khớp kích thước bản gốc",
        ));
    }
    let relative = Path::new(s(asset, "relativePath"));
    if relative.is_absolute()
        || relative
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(invalid("Đường dẫn asset không hợp lệ"));
    }
    let parent = relative
        .parent()
        .ok_or_else(|| invalid("Missing asset parent"))?;
    let mut destination_parent = dir.canonicalize()?;
    for part in parent.components() {
        destination_parent.push(part);
        match fs::symlink_metadata(&destination_parent) {
            Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => {}
            Ok(_) => return Err(invalid("Thư mục asset không được là symlink")),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir(&destination_parent)?
            }
            Err(e) => return Err(e.into()),
        }
    }
    let destination = destination_parent.join(
        relative
            .file_name()
            .ok_or_else(|| invalid("Missing asset name"))?,
    );
    match fs::symlink_metadata(&destination) {
        Ok(meta)
            if meta.is_file()
                && !meta.file_type().is_symlink()
                && storage::sha_file(&destination)? == s(asset, "sha256") =>
        {
            return Ok(())
        }
        Ok(_) => {
            return Err(invalid(
                "File đích đã tồn tại nhưng khác bản gốc; giữ bản đó trước khi phục hồi",
            ))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.into()),
    }
    let mut staged = tempfile::NamedTempFile::new_in(&destination_parent)?;
    let mut input = fs::File::open(source)?;
    std::io::copy(&mut input, &mut staged)?;
    staged.as_file().sync_all()?;
    if storage::sha_file(staged.path())? != s(asset, "sha256") {
        return Err(Error::new("ASSET_CHANGED","File được chọn không khớp SHA-256 bản gốc; hãy chọn đúng file hoặc nhập thành asset mới"));
    }
    staged
        .persist_noclobber(destination)
        .map_err(|e| Error::from(e.error))?;
    #[cfg(unix)]
    fs::File::open(destination_parent)?.sync_all()?;
    Ok(())
}
