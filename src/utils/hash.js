import path from 'path'
import crypto from 'crypto';

/*
a function to get hash value for an given content with desired string length.
input: ('a{}', 'sha', 10)   output: a1b2c3d4e5
*/
export function hash(css, algorithm, trim) {
    return crypto
      .createHash(algorithm)
      .update(css)
      .digest('hex')
      .substr(0, trim);
}

/*
a function to rename a filename by appending hash value.
input: ('./file.css', 'a {}', {algorithm: 'sha256', trim: 10})   output: ./file.a1b2c3d4e5.css
*/
export function rename(file, css, opts) {
    return file
      .substr(0, file.lastIndexOf('.')) + '.' +
      hash(css, opts.algorithm, opts.trim) +
      path.extname(file);
}
