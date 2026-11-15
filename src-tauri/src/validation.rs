/// Memvalidasi teks wajib dan mengembalikan versi yang sudah di-trim.
pub(crate) fn validate_text(
    value: &str,
    label: &str,
    min_length: usize,
    max_length: usize,
) -> Result<String, String> {
    let trimmed = value.trim();
    let length = trimmed.chars().count();

    if length < min_length {
        return Err(format!("{label} minimal {min_length} karakter."));
    }
    if length > max_length {
        return Err(format!("{label} maksimal {max_length} karakter."));
    }

    Ok(trimmed.to_string())
}

/// Memvalidasi teks opsional; string kosong disimpan sebagai NULL.
pub(crate) fn validate_optional_text(
    value: Option<String>,
    label: &str,
    max_length: usize,
) -> Result<Option<String>, String> {
    let Some(value) = value else {
        return Ok(None);
    };

    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if trimmed.chars().count() > max_length {
        return Err(format!("{label} maksimal {max_length} karakter."));
    }

    Ok(Some(trimmed.to_string()))
}

pub(crate) fn validate_customer_name(value: &str) -> Result<String, String> {
    validate_text(value, "Nama pelanggan", 2, 100)
}

pub(crate) fn validate_phone(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let digit_count = trimmed.chars().filter(|character| character.is_ascii_digit()).count();
    let length = trimmed.chars().count();

    if length < 6 {
        return Err("Nomor HP minimal 6 karakter.".to_string());
    }
    if length > 25 || digit_count > 20 {
        return Err("Nomor HP maksimal 20 angka.".to_string());
    }
    if !trimmed.chars().all(|character| {
        character.is_ascii_digit()
            || matches!(character, '+' | '-' | '(' | ')' | ' ')
    }) {
        return Err(
            "Nomor HP hanya boleh berisi angka dan tanda +, -, spasi, atau kurung."
                .to_string(),
        );
    }

    Ok(trimmed.to_string())
}

/// Tanggal bisnis harus valid dalam format YYYY-MM-DD.
pub(crate) fn validate_date(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let parts: Vec<&str> = trimmed.split('-').collect();

    if parts.len() != 3 || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2 {
        return Err("Tanggal tidak valid. Gunakan format YYYY-MM-DD.".to_string());
    }

    let year: i32 = parts[0]
        .parse()
        .map_err(|_| "Tanggal tidak valid. Gunakan format YYYY-MM-DD.".to_string())?;
    let month: u32 = parts[1]
        .parse()
        .map_err(|_| "Tanggal tidak valid. Gunakan format YYYY-MM-DD.".to_string())?;
    let day: u32 = parts[2]
        .parse()
        .map_err(|_| "Tanggal tidak valid. Gunakan format YYYY-MM-DD.".to_string())?;

    if !(2000..=2100).contains(&year) || !(1..=12).contains(&month) {
        return Err("Tanggal tidak valid. Gunakan format YYYY-MM-DD.".to_string());
    }

    let max_day = days_in_month(year, month);
    if day == 0 || day > max_day {
        return Err("Tanggal tidak valid. Periksa kembali tanggal yang dipilih.".to_string());
    }

    Ok(trimmed.to_string())
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        _ => 0,
    }
}

/// Format angka rupiah sederhana untuk pesan error di backend.
pub(crate) fn format_rupiah(value: i64) -> String {
    let raw = value.abs().to_string();
    let mut output = String::new();

    for (index, character) in raw.chars().rev().enumerate() {
        if index > 0 && index % 3 == 0 {
            output.push('.');
        }
        output.push(character);
    }

    let formatted: String = output.chars().rev().collect();
    if value < 0 {
        format!("-Rp {formatted}")
    } else {
        format!("Rp {formatted}")
    }
}
