import pandas as pd


def load_excel_files(file_paths):

    all_frames = []

    for path in file_paths:
        excel = pd.ExcelFile(path)

        for sheet in excel.sheet_names:
            df = excel.parse(sheet)

            if not df.empty:
                all_frames.append(df)

    if not all_frames:
        raise ValueError("No data found in uploaded Excel files.")

    merged = pd.concat(all_frames, ignore_index=True)

    merged.columns = [c.strip() for c in merged.columns]

    # ⭐ ensure numeric types
    for col in merged.columns:
        try:
            merged[col] = pd.to_numeric(merged[col])
        except:
            pass


    return merged
