/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Octokit } from "@octokit/rest";
import * as config from "./config";

let _gh: Octokit | undefined = undefined;

function gh(): Octokit {
  if (_gh === undefined) {
    _gh = new Octokit({
      auth: config.get("github", "token"),
    });
  }

  return _gh;
}

export async function getRepo(owner: string, repo: string) {
  const res = await gh()
    .repos.get({
      owner,
      repo,
    })
    .catch((e) => {
      throw new Error(
        `Unable to get repo ${owner}/${repo}: ${JSON.stringify(e)}`
      );
    });

  return res.data;
}

export async function getRepoLicense(owner: string, repo: string) {
  try {
    const res = await gh().licenses.getForRepo({
      owner,
      repo,
    });

    const content = Buffer.from(res.data.content, res.data.encoding).toString();

    return {
      key: res.data.license?.key,
      content,
    };
  } catch (e) {
    console.warn(`Failed to get license for ${owner}/${repo}`, e);
    return {
      key: undefined,
      content: "",
    };
  }
}

export async function getDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  const res = await gh().repos.get({
    owner,
    repo,
  });

  return res.data.default_branch;
}

export async function getFileContent(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string> {
  const res = await gh()
    .repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    })
    .catch((e) => {
      throw new Error(
        `Unable to fetch file "${path}@${branch}" from "${owner}/${repo}": ${JSON.stringify(
          e
        )}`
      );
    });

  if (Array.isArray(res.data)) {
    throw new Error(
      `Can't get content of a directory: ${JSON.stringify(res.data)}`
    );
  }

  if (res.data.type !== "file") {
    throw new Error(
      `Invalid type ${res.data.type}: ${JSON.stringify(res.data)}`
    );
  }

  // See: https://github.com/octokit/rest.js/issues/1971
  const buffer = Buffer.from(
    (res.data as any).content,
    (res.data as any).encoding
  );
  return buffer.toString("utf-8");
}

export async function getDirectoryContent(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string[]> {
  const res = await gh().repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });

  if (!Array.isArray(res.data)) {
    throw new Error(`Not a directory: ${JSON.stringify(res.data)}`);
  }

  return res.data.map((f) => {
    return f.path;
  });
}
