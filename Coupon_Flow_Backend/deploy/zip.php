<?php

// Usage: php deploy/zip.php <source-dir> <target.zip>
// Zips a folder (dotfiles such as .htaccess included) for SiteGround's File Manager.

[, $source, $target] = $argv;

$root = rtrim((string) realpath($source), DIRECTORY_SEPARATOR);
$zip = new ZipArchive;

if ($root === '' || $zip->open($target, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    fwrite(STDERR, "Cannot zip {$source} into {$target}".PHP_EOL);
    exit(1);
}

$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));

foreach ($files as $file) {
    if ($file->isFile()) {
        $relative = substr($file->getPathname(), strlen($root) + 1);
        $zip->addFile($file->getPathname(), strtr($relative, DIRECTORY_SEPARATOR, '/'));
    }
}

$zip->close();

printf('  %s (%.1f MB)%s', basename($target), filesize($target) / 1048576, PHP_EOL);
