use crate::error::{invalid, Error, Result};
use std::collections::HashMap;
use zeroize::Zeroizing;
#[derive(Default)]
pub struct Secrets {
    session: HashMap<String, Zeroizing<String>>,
}
impl Secrets {
    fn entry(reference: &str) -> Result<keyring::Entry> {
        uuid::Uuid::parse_str(reference)
            .map_err(|_| invalid("Credential reference phải là UUID"))?;
        keyring::Entry::new("vn.studio.aivideo", reference).map_err(|_| {
            Error::new(
                "SECRET_STORE_UNAVAILABLE",
                "Không truy cập được OS secret store",
            )
        })
    }
    pub fn set(&mut self, reference: &str, key: String, session: bool) -> Result<()> {
        let key = Zeroizing::new(key);
        if key.is_empty() {
            return Err(invalid("API key không được rỗng"));
        }
        if session {
            Self::entry(reference)?;
            self.session.insert(reference.into(), key);
        } else {
            Self::entry(reference)?.set_password(&key).map_err(|_| {
                Error::new(
                    "SECRET_STORE_UNAVAILABLE",
                    "Mở khóa secret store hoặc chọn chỉ dùng trong phiên",
                )
            })?;
            self.session.remove(reference);
        }
        Ok(())
    }
    pub fn get(&self, reference: &str) -> Result<Zeroizing<String>> {
        if let Some(k) = self.session.get(reference) {
            return Ok(Zeroizing::new(k.to_string()));
        }
        Self::entry(reference)?
            .get_password()
            .map(Zeroizing::new)
            .map_err(|_| {
                Error::new(
                    "SECRET_MISSING",
                    "Chưa cấu hình key hoặc secret store đang khóa",
                )
            })
    }
    pub fn delete(&mut self, reference: &str) -> Result<()> {
        self.session.remove(reference);
        match Self::entry(reference)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(Error::new(
                "SECRET_STORE_UNAVAILABLE",
                "Không xóa được credential",
            )),
        }
    }
    pub fn configured(&self, reference: &str) -> bool {
        self.get(reference).is_ok()
    }
}
