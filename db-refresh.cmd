@echo off
echo ========================================
echo  SmartOffice - Database Refresh
echo ========================================
echo.

if /i "%1"=="reset" (
    echo MODE: Full reset (drop + migrate + generate + seed)
    echo.
    echo [1/4] Resetting database...
    call npx prisma migrate reset --force
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Database reset failed.
        exit /b 1
    )
    echo.

    echo [2/4] Running migrations...
    call npx prisma migrate dev
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Migration failed.
        exit /b 1
    )
    echo.

    echo [3/4] Generating Prisma client...
    call npx prisma generate
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Prisma generate failed.
        exit /b 1
    )
    echo.

    echo [4/4] Seeding database...
    call npx tsx prisma/seed.ts
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Seed failed.
        exit /b 1
    )
) else (
    echo MODE: Update (migrate + generate + seed)
    echo.
    echo [1/3] Running migrations...
    call npx prisma migrate dev
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Migration failed.
        exit /b 1
    )
    echo.

    echo [2/3] Generating Prisma client...
    call npx prisma generate
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Prisma generate failed.
        exit /b 1
    )
    echo.

    echo [3/3] Seeding database...
    call npx tsx prisma/seed.ts
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Seed failed.
        exit /b 1
    )
)

echo.
echo ========================================
echo  Done! Database is up to date.
echo ========================================
